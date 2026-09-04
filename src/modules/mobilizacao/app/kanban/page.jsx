import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  LayoutGrid, Loader2, AlertCircle, Inbox, User, X, Lock, AlertTriangle, CalendarClock,
} from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { ehTimeMobilizacao, FLUXOS, rotuloFluxoCurto } from '../../../../config/mobilizacao';
import { semaforoDias } from '../../../../utils/semaforo';
import { listarEtapasDoQuadro, moverEtapa, listarEtapasDoProcesso } from '../../lib/mobilizacao';
import {
  agruparEmColunas, statusAoSoltar, podeMover, podeEditar, iniciais,
  estaAtrasada, venceHoje,
} from '../../lib/painelEtapas';

const dataBr = (iso) => (iso ? iso.split('-').reverse().join('/') : 'sem prazo');

const textoPrazo = (etapa) => {
  if (!etapa.data_prevista) return 'Sem prazo';
  const d = Number(etapa.dias_atraso);
  if (!Number.isFinite(d)) return dataBr(etapa.data_prevista);
  if (d > 0) return `${dataBr(etapa.data_prevista)} · ${d}d de atraso`;
  if (d === 0) return `${dataBr(etapa.data_prevista)} · vence hoje`;
  return dataBr(etapa.data_prevista);
};

export default function KanbanMob() {
  const { user, modules } = useAuth();
  const navigate = useNavigate();
  const souTime = ehTimeMobilizacao(modules);

  const [etapas, setEtapas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [apenasMinhas, setApenasMinhas] = useState(!souTime);
  const [fFluxo, setFFluxo] = useState('');
  // '' | 'atrasadas' | 'hoje'. Os dois se excluem: uma etapa que ja venceu nao
  // vence hoje, entao liga-los juntos devolveria lista vazia sempre.
  const [fPrazo, setFPrazo] = useState('');
  // A etapa em movimento, para saber quais colunas recusar o drop.
  const [arrastando, setArrastando] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      setEtapas(await listarEtapasDoQuadro({ fluxo: fFluxo }));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [fFluxo]);

  useEffect(() => { carregar(); }, [carregar]);

  const porDono = apenasMinhas ? etapas.filter((e) => e.responsavel_id === user?.id) : etapas;
  const visiveis = porDono.filter((e) => {
    if (fPrazo === 'atrasadas') return estaAtrasada(e);
    if (fPrazo === 'hoje') return venceHoje(e);
    return true;
  });
  const colunas = agruparEmColunas(visiveis);

  /**
   * O drop.
   *
   * Grava SÓ o status. `data_real`, o prazo das etapas dependentes, o progresso
   * do processo e o evento no histórico saem do gatilho no banco — por isso,
   * depois do sucesso, recarregamos as etapas DAQUELE processo (e não o quadro
   * inteiro) para trazer os prazos recalculados. O otimismo nunca inventa
   * data_prevista.
   */
  const aoSoltar = async (resultado) => {
    setArrastando(null);
    const { destination, source, draggableId } = resultado;
    if (!destination || destination.droppableId === source.droppableId) return;

    const etapa = etapas.find((e) => e.id === draggableId);
    const novo = statusAoSoltar(destination.droppableId);
    if (!etapa || !novo) return;

    const irmas = etapas.filter((e) => e.processo_id === etapa.processo_id);
    const permitido = podeMover(etapa, destination.droppableId, irmas);
    if (!permitido.ok) { setErro(permitido.motivo); return; }

    const antes = etapa.status;
    setErro('');
    setEtapas((prev) => prev.map((e) => (e.id === etapa.id ? { ...e, status: novo } : e)));

    try {
      await moverEtapa(etapa.id, novo);
      const atualizadas = await listarEtapasDoProcesso(etapa.processo_id);
      const porId = new Map(atualizadas.map((e) => [e.id, e]));
      setEtapas((prev) => prev.map((e) => {
        const nova = porId.get(e.id);
        // Só os campos que o gatilho recalcula; o resto (dados do processo,
        // nome do responsável) já está montado e não vem nessa consulta.
        return nova
          ? { ...e, status: nova.status, data_prevista: nova.data_prevista, data_real: nova.data_real, dias_atraso: nova.dias_atraso }
          : e;
      }));
    } catch (e) {
      // Rollback. UPDATE barrado pela RLS devolve zero linhas sem erro, e é a
      // lib que transforma isso em exceção.
      setEtapas((prev) => prev.map((x) => (x.id === etapa.id ? { ...x, status: antes } : x)));
      setErro(e.message);
    }
  };

  const filtrando = !!fFluxo || apenasMinhas || !!fPrazo;
  // Clicar de novo no filtro ligado desliga: sem isso a unica saida seria o
  // botao de limpar, que tambem zera fluxo e aba.
  const alternarPrazo = (v) => setFPrazo((atual) => (atual === v ? '' : v));

  return (
    <div className="mob-page mob-page-full mob-page-quadro">
      <h1 className="mob-title"><LayoutGrid size={24} /> Quadro</h1>
      <p className="mob-sub">
        Cada cartão é um PASSO de uma mobilização. Arraste para atualizar a situação —
        você move os passos pelos quais responde.
      </p>

      <div className="mob-tabs">
        <button type="button" className={`mob-tab ${!apenasMinhas ? 'is-active' : ''}`}
          onClick={() => setApenasMinhas(false)}>
          <Inbox size={15} /> Todas
        </button>
        <button type="button" className={`mob-tab ${apenasMinhas ? 'is-active' : ''}`}
          onClick={() => setApenasMinhas(true)}>
          <User size={15} /> Minhas etapas
        </button>
      </div>

      <div className="mob-filtros">
        <div className="mob-filtro">
          <label htmlFor="mob-q-fluxo">Fluxo</label>
          <select id="mob-q-fluxo" value={fFluxo} onChange={(e) => setFFluxo(e.target.value)}>
            <option value="">Todos</option>
            {FLUXOS.map((f) => <option key={f.slug} value={f.slug}>{f.label}</option>)}
          </select>
        </div>
        <button type="button"
          className={`mob-btn mob-btn-sm mob-filtro-limpa ${fPrazo === 'atrasadas' ? 'mob-btn-primary' : 'mob-btn-ghost'}`}
          onClick={() => alternarPrazo('atrasadas')}>
          <AlertTriangle size={15} /> Em atraso
        </button>

        <button type="button"
          className={`mob-btn mob-btn-sm mob-filtro-limpa ${fPrazo === 'hoje' ? 'mob-btn-primary' : 'mob-btn-ghost'}`}
          onClick={() => alternarPrazo('hoje')}>
          <CalendarClock size={15} /> Vence hoje
        </button>

        {filtrando && (
          <button type="button" className="mob-btn mob-btn-ghost mob-btn-sm mob-filtro-limpa"
            onClick={() => { setFFluxo(''); setApenasMinhas(false); setFPrazo(''); }}>
            <X size={15} /> Limpar filtros
          </button>
        )}
      </div>

      {filtrando && !carregando && (
        <p className="mob-campo-dica">Mostrando {visiveis.length} de {etapas.length} etapas.</p>
      )}

      {erro && <div className="mob-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      {carregando ? (
        <div className="mob-vazio"><Loader2 size={20} className="mob-spin" /> Carregando…</div>
      ) : (
        <DragDropContext onDragStart={(i) => setArrastando(etapas.find((e) => e.id === i.draggableId) || null)}
          onDragEnd={aoSoltar}>
          <div className="mob-quadro">
            {colunas.map((col) => {
              // Coluna que recusaria o drop fica apagada DURANTE o arrasto: o
              // aviso depois de soltar chega tarde, quando a pessoa já esperava
              // que fosse funcionar.
              const bloqueada = !!arrastando && !podeMover(
                arrastando, col.chave, etapas.filter((e) => e.processo_id === arrastando.processo_id),
              ).ok;

              return (
                <Droppable key={col.chave} droppableId={col.chave} isDropDisabled={bloqueada}>
                  {(prov, snap) => (
                    <section
                      className={`mob-col ${snap.isDraggingOver ? 'is-alvo' : ''} ${bloqueada ? 'is-bloqueada' : ''}`}
                      ref={prov.innerRef}
                      {...prov.droppableProps}
                    >
                      <header className="mob-col-cab">
                        <h2>{col.titulo}</h2>
                        <span className="mob-col-cont">{col.itens.length}</span>
                      </header>

                      <div className="mob-col-corpo">
                        {col.itens.length === 0 && <p className="mob-col-vazia">—</p>}

                        {col.itens.map((e, idx) => {
                          const editavel = podeEditar(e, { meuId: user?.id, souTime });
                          const tom = semaforoDias(e.dias_atraso);

                          return (
                            <Draggable key={e.id} draggableId={e.id} index={idx} isDragDisabled={!editavel}>
                              {(p, s) => (
                                <article
                                  ref={p.innerRef}
                                  {...p.draggableProps}
                                  {...p.dragHandleProps}
                                  className={[
                                    'mob-cartao is-clicavel',
                                    s.isDragging ? 'is-arrastando' : '',
                                    editavel ? '' : 'is-travado',
                                  ].join(' ').trim()}
                                  role="button"
                                  tabIndex={0}
                                  // Só navega quando NÃO está arrastando: no
                                  // touch, o gesto de arrastar dispara o clique
                                  // no fim e a pessoa acabaria noutra tela.
                                  onClick={() => { if (!s.isDragging) navigate(`/mobilizacao/processo/${e.processo_id}`); }}
                                  onKeyDown={(ev) => {
                                    if (ev.key === 'Enter' || ev.key === ' ') {
                                      ev.preventDefault();
                                      navigate(`/mobilizacao/processo/${e.processo_id}`);
                                    }
                                  }}
                                >
                                  <div className="mob-cartao-topo">
                                    <span className="mob-cartao-num">#{e.numero}</span>
                                    <span className="mob-cartao-fluxo">{rotuloFluxoCurto(e.fluxo)}</span>
                                    {!editavel && <Lock size={11} className="mob-cartao-trava" aria-label="Você não responde por esta etapa" />}
                                  </div>

                                  <strong className="mob-cartao-titulo">{e.titulo}</strong>
                                  <span className="mob-cartao-proc">{e.processoTitulo}</span>

                                  <div className="mob-cartao-rodape">
                                    {/* Sem responsável é o estado que precisa
                                        saltar: é o passo que ninguém está
                                        olhando. */}
                                    {e.responsavelNome ? (
                                      <span className="mob-cartao-dono" title={e.responsavelNome}>
                                        {iniciais(e.responsavelNome)}
                                      </span>
                                    ) : (
                                      <span className="mob-cartao-sem-dono">sem responsável</span>
                                    )}
                                    <span className={`mob-prazo tom-${tom}`}>{textoPrazo(e)}</span>
                                  </div>
                                </article>
                              )}
                            </Draggable>
                          );
                        })}
                        {prov.placeholder}
                      </div>
                    </section>
                  )}
                </Droppable>
              );
            })}
          </div>
        </DragDropContext>
      )}

      {!carregando && !visiveis.length && (
        <p className="mob-campo-dica">
          {apenasMinhas
            ? 'Nenhuma etapa no seu nome. Veja "Todas" para o que está em aberto.'
            : 'Nada por aqui ainda. Os processos de pessoas nascem do chamado de Mobilização do Administrativo; os de empresa são abertos em "Abrir processo".'}
        </p>
      )}
    </div>
  );
}
