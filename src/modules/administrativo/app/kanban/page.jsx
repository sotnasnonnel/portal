import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutGrid, AlertCircle, Inbox, Clock, MessageSquare, X, UserX, SearchX, SlidersHorizontal,
  ChevronLeft, ChevronRight, FilePlus2,
} from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { getClasse, ehTimeDp } from '../../../../config/administrativo';
import { listarQuadro } from '../../lib/chamados';
import {
  agruparEmColunas, iniciais, filtrarQuadro, opcoesDoQuadro, restaurarFiltro,
} from '../../lib/painel';
import { estaAtrasado } from '../../lib/indicadores';
import { ehEncerrado } from '../../lib/statusChamado';
import { useEstadoPersistido } from '../../../../hooks/useEstadoPersistido';
import SearchSelect from '../../../../components/UI/SearchSelect';
import { CabecalhoPagina, Abas, StatusBadge, PrazoSla, Vazio, Carregando } from '../components/ui';

const QUADRO_VAZIO = { solicitanteId: '', cc: '', atrasado: '' };

/**
 * Diz se há colunas escondidas de cada lado e qual está em foco.
 * Cinco colunas de largura fixa não cabem nem em 1440px: a última ficava fora da
 * tela sem nada dizendo que existia.
 */
function useRolagemLateral(prontoParaMedir) {
  const ref = useRef(null);
  const [estado, setEstado] = useState({ esq: false, dir: false, ativa: 0 });

  const medir = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // Folga de 2px: a rolagem fracionária em tela com zoom nunca chega ao fim exato.
    const esq = el.scrollLeft > 2;
    const dir = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    // Distância entre colunas, e não a largura de uma: o vão entra na conta.
    const passoColuna = el.children[1] ? el.children[1].offsetLeft - el.children[0].offsetLeft : 1;
    const ativa = Math.round(el.scrollLeft / passoColuna);
    setEstado((a) => (a.esq === esq && a.dir === dir && a.ativa === ativa ? a : { esq, dir, ativa }));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, [medir, prontoParaMedir]);

  const rolarAte = useCallback((esquerda) => {
    const parado = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    ref.current?.scrollTo({ left: esquerda, behavior: parado ? 'auto' : 'smooth' });
  }, []);

  const irParaColuna = useCallback((i) => {
    const el = ref.current;
    const coluna = el?.children[i];
    if (coluna) rolarAte(coluna.offsetLeft - el.offsetLeft);
  }, [rolarAte]);

  const passo = useCallback((direcao) => {
    const el = ref.current;
    if (!el) return;
    // Anda uma tela menos uma coluna, para a última visível servir de referência.
    const larguraColuna = el.firstElementChild?.getBoundingClientRect().width || 0;
    rolarAte(el.scrollLeft + direcao * Math.max(el.clientWidth - larguraColuna, larguraColuna));
  }, [rolarAte]);

  return { ref, ...estado, medir, irParaColuna, passo };
}

export default function KanbanAdm() {
  const { user, modules } = useAuth();
  // Mesmo motivo da Fila: abrir um cartão para avaliar e voltar não pode apagar
  // o filtro. Persiste na aba do navegador (ver useEstadoPersistido).
  const chave = (nome) => (user?.id ? `adm:quadro:${nome}:${user.id}` : '');
  const [apenasMeus, setApenasMeus] = useEstadoPersistido(chave('meus'), false, {
    restaurar: (v) => v === true,
  });
  const [chamados, setChamados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  // Mesma ideia da Fila: "Todos" já traz os dois números, e "Atribuídos a mim"
  // guarda o último visto do outro em vez de ir ao banco só para contar.
  const [totais, setTotais] = useState({});
  const [filtroQuadro, setFiltroQuadro] = useEstadoPersistido(chave('filtro'), QUADRO_VAZIO, {
    restaurar: (v) => restaurarFiltro(v, QUADRO_VAZIO),
  });
  const { solicitanteId: fSolicitante, cc: fCc, atrasado: fAtrasado } = filtroQuadro;
  // Atualizador funcional: o "Limpar filtros" chama os três em sequência, e cada
  // um precisa partir do resultado do anterior.
  const mudarFiltro = (campo) => (valor) => setFiltroQuadro((f) => ({ ...f, [campo]: valor }));
  const setFSolicitante = mudarFiltro('solicitanteId');
  const setFCc = mudarFiltro('cc');
  const setFAtrasado = mudarFiltro('atrasado');
  const limpar = () => { setFSolicitante(''); setFCc(''); setFAtrasado(''); };

  // O DP também é time: atende os chamados de DP, que a RLS esconde do Adm.
  const souAdm = modules?.administrativo === 'admin' || modules?.administrativo === 'atendente' || ehTimeDp(user);

  const carregar = useCallback(async () => {
    if (!user?.id) return;
    setCarregando(true);
    setErro('');
    try {
      const lista = await listarQuadro(user.id, { apenasMeus, souTime: souAdm });
      setChamados(lista);
      setTotais((t) => (apenasMeus
        ? { ...t, meus: lista.length }
        : { todos: lista.length, meus: lista.filter((c) => c.atendente_id === user.id).length }));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [user?.id, apenasMeus, souAdm]);

  useEffect(() => { carregar(); }, [carregar]);

  const agora = Date.now();
  // Filtro do Adm: "como está tudo do projeto crítico". O CC é o que amarra os
  // chamados de um mesmo projeto, mesmo espalhados por classes diferentes.
  const { solicitantes, ccs } = opcoesDoQuadro(chamados);
  const visiveis = souAdm
    ? filtrarQuadro(chamados, { solicitanteId: fSolicitante, cc: fCc, atrasado: fAtrasado }, agora)
    : chamados;
  const colunas = agruparEmColunas(visiveis);
  const filtrando = !!(fSolicitante || fCc || fAtrasado);
  const qtdFiltros = [fSolicitante, fCc, fAtrasado].filter(Boolean).length;

  const temQuadro = !carregando && !erro && visiveis.length > 0;
  const rolagem = useRolagemLateral(temQuadro);

  // A coluna muda com o dedo no quadro, e o botão dela pode estar fora da faixa
  // de botões. Sem a faixa (desktop) ela não tem largura e nada acontece.
  const refNav = useRef(null);
  useEffect(() => {
    const nav = refNav.current;
    const item = nav?.children[rolagem.ativa];
    if (item && nav.clientWidth) nav.scrollTo({ left: item.offsetLeft - nav.offsetLeft - 8 });
  }, [rolagem.ativa]);

  return (
    <div className="adm-page adm-page-full adm-page-quadro">
      <CabecalhoPagina
        Icon={LayoutGrid}
        titulo="Quadro"
        subtitulo={souAdm
          ? 'Onde cada chamado está, quem responde por ele e quanto falta do prazo. Clique num cartão para abrir e agir.'
          : 'Onde estão os seus chamados e quanto falta do prazo. Clique num cartão para abrir.'}
      />

      {/* Filtros só para quem atende — o solicitante já vê apenas o que é dele
          (RLS), então filtrar por outra pessoa não teria efeito nenhum. */}
      {souAdm && (
        <>
          {/* Abas e filtros na mesma faixa: o quadro é a tela em que cada linha de
              cabeçalho sai direto da altura das colunas. */}
          <div className="adm-quadro-barra">
            <Abas
              rotulo="Recorte do quadro"
              valor={apenasMeus ? 'meus' : 'todos'}
              onChange={(v) => setApenasMeus(v === 'meus')}
              itens={[
                { valor: 'todos', rotulo: 'Todos', Icon: Inbox, contagem: totais.todos },
                { valor: 'meus', rotulo: 'Atribuídos a mim', Icon: Clock, contagem: totais.meus },
              ]}
            />
            <button type="button" className="adm-btn adm-btn-ghost adm-fila-filtros-btn"
              aria-expanded={filtrosAbertos} aria-controls="adm-quadro-filtros"
              onClick={() => setFiltrosAbertos((v) => !v)}>
              <SlidersHorizontal size={15} aria-hidden="true" /> Filtros
              {qtdFiltros > 0 && <span className="adm-tab-cont">{qtdFiltros}</span>}
            </button>
            <div id="adm-quadro-filtros" className={`adm-quadro-filtros ${filtrosAbertos ? 'is-aberto' : ''}`}>
              {/* Sem rótulo em cima: a própria opção vazia diz do que é o filtro,
                  e o rótulo custava uma linha inteira de quadro. */}
              <div className={`adm-quadro-filtro${fSolicitante ? ' is-ativo' : ''}`}>
                <SearchSelect value={fSolicitante} onChange={setFSolicitante}
                  options={[{ value: '', label: 'Solicitante: todos' }, ...solicitantes]}
                  placeholder="Solicitante: todos" ariaLabel="Filtrar por solicitante" />
              </div>
              <div className={`adm-quadro-filtro${fCc ? ' is-ativo' : ''}`}>
                <SearchSelect value={fCc} onChange={setFCc}
                  options={[{ value: '', label: 'Centro de custo: todos' }, ...ccs.map((v) => ({ value: v, label: v }))]}
                  placeholder="Centro de custo: todos" ariaLabel="Filtrar por centro de custo" />
              </div>
              {/* Prazo é <select> puro, e não SearchSelect: são três opções
                  fixas, não uma lista para procurar dentro. */}
              <div className={`adm-quadro-filtro${fAtrasado ? ' is-ativo' : ''}`}>
                <select className="adm-select" aria-label="Filtrar por prazo" value={fAtrasado}
                  onChange={(e) => setFAtrasado(e.target.value)}>
                  <option value="">Prazo: todos</option>
                  <option value="sim">Só atrasados</option>
                  <option value="nao">Dentro do prazo</option>
                </select>
              </div>
            </div>
          </div>

          {filtrando && (
            <p className="adm-campo-dica adm-quadro-resultado">
              <span>
                Mostrando {visiveis.length} de {chamados.length} chamados.
                {/* Sem esta frase, a coluna Concluído vazia pareceria bug. */}
                {fAtrasado === 'sim' && ' Atrasado é o que ainda está em jogo e passou do prazo — por isso a coluna Concluído fica vazia.'}
              </span>
              <button type="button" className="adm-link adm-link-btn adm-quadro-limpar" onClick={limpar}>
                <X size={13} aria-hidden="true" /> Limpar filtros
              </button>
            </p>
          )}
        </>
      )}

      {erro && (
        <div className="adm-aviso tom-erro" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>
            {erro}{' '}
            <button type="button" className="adm-link adm-link-btn adm-fila-tentar" onClick={carregar}>
              Tentar de novo
            </button>
          </span>
        </div>
      )}

      {carregando ? (
        <Carregando />
      ) : erro ? (
        // Falhou ao carregar: cinco colunas vazias afirmariam que não há chamado.
        null
      ) : chamados.length === 0 ? (
        souAdm ? (
          <Vazio
            Icon={Inbox}
            titulo={apenasMeus ? 'Nenhum chamado atribuído a você' : 'Nenhum chamado no quadro'}
            acao={apenasMeus && (
              <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm"
                onClick={() => setApenasMeus(false)}>Ver todos</button>
            )}
          />
        ) : (
          <Vazio
            Icon={Inbox}
            titulo="Você não tem chamados no quadro"
            acao={(
              <Link className="adm-btn adm-btn-primary" to="/administrativo/novo">
                <FilePlus2 size={16} aria-hidden="true" /> Abrir chamado
              </Link>
            )}
          >
            Quando abrir um chamado, ele aparece aqui até ser concluído.
          </Vazio>
        )
      ) : visiveis.length === 0 ? (
        <Vazio
          Icon={SearchX}
          titulo="Nenhum chamado com esses filtros"
          acao={(
            <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={limpar}>
              Limpar filtros
            </button>
          )}
        />
      ) : (
        <>
          {/* No celular só cabe uma coluna: estes botões são o mapa das outras
              (e de quantos chamados há em cada uma). */}
          <nav className="adm-quadro-nav" aria-label="Colunas do quadro" ref={refNav}>
            {colunas.map((col, i) => (
              <button key={col.chave} type="button"
                className={`adm-quadro-nav-item${rolagem.ativa === i ? ' is-ativo' : ''}`}
                aria-current={rolagem.ativa === i ? 'true' : undefined}
                onClick={() => rolagem.irParaColuna(i)}>
                {col.titulo} <span className="adm-tab-cont">{col.itens.length}</span>
              </button>
            ))}
          </nav>

          <div className={`adm-quadro-moldura${rolagem.esq ? ' tem-esq' : ''}${rolagem.dir ? ' tem-dir' : ''}`}>
            <div className="adm-quadro" ref={rolagem.ref} onScroll={rolagem.medir}>
              {colunas.map((col) => {
                const vencidos = col.itens.filter((c) => estaAtrasado(c, agora)).length;
                return (
                  <section key={col.chave} className="adm-col" aria-labelledby={`adm-col-${col.chave}`}>
                    <header className="adm-col-cab">
                      <h2 id={`adm-col-${col.chave}`}>{col.titulo}</h2>
                      {/* Com o quadro rolando de lado, é pelo cabeçalho que se vê
                          onde está o incêndio sem descer pelos cartões. */}
                      {vencidos > 0 && (
                        <span className="adm-col-vencidos">
                          {vencidos === 1 ? '1 vencido' : `${vencidos} vencidos`}
                        </span>
                      )}
                      <span className="adm-col-cont" aria-label={`${col.itens.length} chamados`}>
                        {col.itens.length}
                      </span>
                    </header>

                    <div className="adm-col-corpo">
                      {col.itens.length === 0 ? (
                        <p className="adm-col-vazia">Nenhum chamado</p>
                      ) : col.itens.map((c) => {
                        const cls = getClasse(c.classe);
                        const encerrado = ehEncerrado(c.status);
                        return (
                          <Link key={c.id} to={`/administrativo/chamado/${c.id}`}
                            className={`adm-cartao${estaAtrasado(c, agora) ? ' is-vencido' : ''}`}>
                            <div className="adm-cartao-topo">
                              <span className="adm-cartao-num">#{c.numero}</span>
                              {/* A coluna Concluído junta fechado, reprovado e
                                  cancelado: só o selo diz qual foi. */}
                              {encerrado && <StatusBadge status={c.status} />}
                              {c.naoLidas > 0 && (
                                <span className="adm-cartao-msg" role="img"
                                  title={`${c.naoLidas} mensagem(ns) não lida(s)`}
                                  aria-label={`${c.naoLidas} mensagem(ns) não lida(s)`}>
                                  <MessageSquare size={12} aria-hidden="true" /> {c.naoLidas}
                                </span>
                              )}
                            </div>
                            <strong className="adm-cartao-assunto">{c.assunto}</strong>
                            <span className="adm-cartao-classe">{cls?.label || c.classe}</span>

                            <div className="adm-cartao-rodape">
                              {/* Sem responsável é o estado que precisa saltar: é o
                                  chamado que ninguém está olhando. As iniciais sozinhas
                                  obrigavam a passar o mouse para saber quem era. */}
                              {c.atendenteNome ? (
                                <span className="adm-cartao-pessoa" title={c.atendenteNome}>
                                  <span className="adm-cartao-dono" aria-hidden="true">
                                    {iniciais(c.atendenteNome)}
                                  </span>
                                  <span className="adm-cartao-nome">{c.atendenteNome.split(' ')[0]}</span>
                                </span>
                              ) : !encerrado && (
                                <span className="adm-cartao-sem-dono">
                                  <UserX size={12} aria-hidden="true" /> Sem responsável
                                </span>
                              )}
                              <PrazoSla venceEm={c.sla_vence_em} encerrado={encerrado} agora={agora} />
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
            {rolagem.esq && (
              <button type="button" className="adm-quadro-seta is-esq" aria-label="Ver colunas à esquerda"
                onClick={() => rolagem.passo(-1)}>
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
            )}
            {rolagem.dir && (
              <button type="button" className="adm-quadro-seta is-dir" aria-label="Ver colunas à direita"
                onClick={() => rolagem.passo(1)}>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
