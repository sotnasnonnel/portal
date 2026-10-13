import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Check, X, ExternalLink, Loader2, RefreshCw, AlertTriangle, CheckCircle2, Clock, MessageSquare,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import DestinoHEModal from '../../horas/app/components/DestinoHEModal';
import { listarPendencias, decidirPendencia } from '../lib/fontes';
import { agruparPorFonte, erroDaDecisao, nomeDaFonte, FONTES } from '../lib/central';
import { iniciais, nomeProprio } from '../../../utils/pessoas';
import '../aprovacoes.css';

const diasDesde = (iso) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null);
const haQuanto = (iso) => {
  const dias = diasDesde(iso);
  if (dias === null) return '';
  if (dias <= 0) return 'chegou hoje';
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
};
// A partir daqui o tempo de espera ganha cor: é o que já está atrasando alguém.
const DIAS_ATRASO = 3;

/**
 * Central de Aprovações: tudo o que espera a decisão do usuário, em todos os
 * módulos. Pedido do André (29/09/2026) — o aviso chegava, mas a decisão exigia
 * entrar em cada módulo.
 *
 * Não tem dado próprio: lê de cada módulo e decide pela mesma função da tela
 * dele (lib/fontes.js), então a decisão já vale lá, com os mesmos avisos.
 *
 * Aprovar é um clique. O campo de texto só abre quando é preciso: ao reprovar
 * (o motivo é o que o solicitante vai ler) ou quando a pessoa quer deixar uma
 * observação. Com a caixa sempre aberta, cada pedido ocupava o dobro da tela.
 */
export default function CentralAprovacoes() {
  const { user, reembolsoProfile } = useAuth();
  const ctx = useMemo(() => ({ user, reembolsoProfile }), [user, reembolsoProfile]);
  const [busca] = useSearchParams();
  const alvo = busca.get('item'); // vindo do "Revisar" da Home
  const [itens, setItens] = useState([]);
  const [falhas, setFalhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [comentarios, setComentarios] = useState({});
  const [abertos, setAbertos] = useState({}); // chave -> 'reprovar' | 'obs'
  const [erros, setErros] = useState({});
  const [ocupado, setOcupado] = useState('');
  const [aviso, setAviso] = useState('');
  const [destinoHe, setDestinoHe] = useState(null); // item de hora extra aprovando
  const rolou = useRef(false);

  const carregar = useCallback(async () => {
    if (!user?.id) return;
    setCarregando(true);
    const r = await listarPendencias(ctx);
    setItens(r.itens);
    setFalhas(r.falhas);
    setCarregando(false);
  }, [ctx, user?.id]);

  useEffect(() => { carregar(); }, [carregar]);

  // Chegou pelo "Revisar" da Home: rola até o pedido uma vez, depois da carga.
  useEffect(() => {
    if (carregando || !alvo || rolou.current) return;
    rolou.current = true;
    document.getElementById(`apv-${alvo}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [carregando, alvo]);

  const visiveis = filtro ? itens.filter((i) => i.fonte === filtro) : itens;
  const grupos = agruparPorFonte(visiveis);
  const contagem = (chave) => itens.filter((i) => i.fonte === chave).length;
  const maisAntigo = Math.max(0, ...itens.map((i) => diasDesde(i.quando) ?? 0));

  const abrir = (chave, modo) => {
    setAbertos((a) => ({ ...a, [chave]: modo }));
    setErros((e) => ({ ...e, [chave]: '' }));
  };
  const fechar = (chave) => {
    setAbertos((a) => ({ ...a, [chave]: null }));
    setErros((e) => ({ ...e, [chave]: '' }));
  };

  async function decidir(item, aprovar, extra = null) {
    const comentario = comentarios[item.chave] || '';
    const erro = erroDaDecisao({ aprovar, comentario });
    if (erro) {
      setErros((e) => ({ ...e, [item.chave]: erro }));
      return;
    }
    setErros((e) => ({ ...e, [item.chave]: '' }));
    setOcupado(item.chave);
    setAviso('');
    try {
      const r = await decidirPendencia(item, { aprovar, comentario, extra }, ctx);
      if (r === 'ja_tratada') {
        setAviso(`${item.titulo}: já tinha sido decidido por outra pessoa. A lista foi atualizada.`);
        await carregar();
        return;
      }
      // Sai da lista na hora, sem esperar reler os sete módulos.
      setItens((lista) => lista.filter((i) => i.chave !== item.chave));
      setAviso(`${item.titulo} ${aprovar ? 'aprovado' : 'reprovado'}. A decisão já está no ${nomeDaFonte(item.fonte)}.`);
    } catch (e) {
      setErros((x) => ({ ...x, [item.chave]: e?.message || 'Não foi possível registrar a decisão.' }));
    } finally {
      setOcupado('');
    }
  }

  const aprovar = (item) => (item.precisaDestino ? setDestinoHe(item) : decidir(item, true));

  return (
    <div className="apv-page">
      <header className="apv-header">
        <Link to="/home" className="apv-back"><ArrowLeft size={16} /> Voltar ao portal</Link>
        <div className="apv-header-linha">
          <div className="apv-titulos">
            <h1>Aprovações</h1>
            <p>
              {carregando
                ? 'Buscando nos módulos…'
                : itens.length === 0
                  ? 'Nada esperando a sua decisão.'
                  : <>
                    <b>{itens.length} {itens.length === 1 ? 'pedido esperando' : 'pedidos esperando'}</b> a sua decisão
                    {maisAntigo > 0 && <> · o mais antigo há {maisAntigo} {maisAntigo === 1 ? 'dia' : 'dias'}</>}
                  </>}
            </p>
          </div>
          <button type="button" className="apv-btn apv-btn-ghost" onClick={carregar} disabled={carregando}>
            <RefreshCw size={15} className={carregando ? 'apv-spin' : ''} /> Atualizar
          </button>
        </div>
        <p className="apv-nota">O que você decide aqui já vale no módulo de origem, com os mesmos avisos.</p>
      </header>

      {aviso && (
        <div className="apv-aviso tom-ok" role="status"><CheckCircle2 size={16} /> {aviso}</div>
      )}
      {falhas.length > 0 && (
        <div className="apv-aviso tom-alerta">
          <AlertTriangle size={16} />
          <span>
            Não foi possível ler {falhas.map((f) => nomeDaFonte(f.fonte)).join(', ')} agora. O que
            está abaixo pode estar incompleto — tente atualizar.
          </span>
        </div>
      )}

      {!carregando && itens.length > 0 && (
        <div className="apv-filtros" role="group" aria-label="Filtrar por módulo">
          <button type="button" className={`apv-chip ${!filtro ? 'is-on' : ''}`} onClick={() => setFiltro('')}>
            Todas <span>{itens.length}</span>
          </button>
          {FONTES.filter((f) => contagem(f.chave) > 0).map((f) => (
            <button key={f.chave} type="button" className={`apv-chip ${filtro === f.chave ? 'is-on' : ''}`}
              onClick={() => setFiltro(f.chave)}>
              {f.modulo} <span>{contagem(f.chave)}</span>
            </button>
          ))}
        </div>
      )}

      {carregando ? (
        <div className="apv-carregando" aria-hidden="true">
          {[0, 1, 2].map((n) => <div key={n} className="apv-esqueleto" />)}
        </div>
      ) : itens.length === 0 ? (
        <div className="apv-vazio">
          <span className="apv-vazio-ic"><Check size={28} /></span>
          <h2>Tudo em dia</h2>
          <p>Nenhum pedido esperando a sua aprovação. Quando chegar um, ele aparece aqui.</p>
          <Link to="/home" className="apv-btn apv-btn-ghost">Voltar ao portal</Link>
        </div>
      ) : (
        grupos.map((g) => (
          <section key={g.chave} className="apv-grupo">
            <h2>{g.modulo} <span className="apv-grupo-num">{g.itens.length}</span></h2>
            {g.itens.map((item) => {
              const verbos = item.verbos || { aprovar: 'Aprovar', reprovar: 'Reprovar' };
              const esteOcupado = ocupado === item.chave;
              const modo = abertos[item.chave];
              const dias = diasDesde(item.quando);
              return (
                <article
                  key={item.chave}
                  id={`apv-${item.chave}`}
                  className={`apv-item${alvo === item.chave ? ' is-alvo' : ''}`}
                >
                  <div className="apv-item-cab">
                    <span className="apv-pav">{iniciais(item.pessoa)}</span>
                    <div className="apv-item-tit">
                      <h3>{item.titulo}</h3>
                      <p className="apv-item-sub">
                        {item.pessoa && <span>{nomeProprio(item.pessoa)}</span>}
                        {item.quando && (
                          <span className={`apv-espera${dias >= DIAS_ATRASO ? ' is-atraso' : ''}`}>
                            <Clock size={13} aria-hidden="true" /> {haQuanto(item.quando)}
                          </span>
                        )}
                      </p>
                    </div>
                    <Link to={item.link} className="apv-abrir">
                      Abrir no módulo <ExternalLink size={14} />
                    </Link>
                  </div>

                  {item.detalhes.length > 0 && (
                    <dl className="apv-detalhes">
                      {item.detalhes.map(([rot, val]) => (
                        <div key={rot}><dt>{rot}</dt><dd>{val}</dd></div>
                      ))}
                    </dl>
                  )}

                  {!item.direto ? (
                    <p className="apv-no-modulo">
                      <AlertTriangle size={14} /> {item.motivoAbrir}
                    </p>
                  ) : modo ? (
                    <div className={`apv-decisao${modo === 'reprovar' ? ' is-reprovar' : ''}`}>
                      <label className="apv-rotulo" htmlFor={`apv-c-${item.chave}`}>
                        {modo === 'reprovar'
                          ? 'Motivo da reprovação (o solicitante vai ler)'
                          : 'Observação (fica registrada no pedido, junto da decisão)'}
                      </label>
                      <textarea
                        id={`apv-c-${item.chave}`}
                        className="apv-textarea"
                        rows={2}
                        autoFocus
                        value={comentarios[item.chave] || ''}
                        onChange={(e) => setComentarios((c) => ({ ...c, [item.chave]: e.target.value }))}
                      />
                      {erros[item.chave] && <p className="apv-erro" role="alert">{erros[item.chave]}</p>}
                      <div className="apv-acoes">
                        {modo === 'reprovar' ? (
                          <button type="button" className="apv-btn apv-btn-nao-cheio" disabled={esteOcupado}
                            onClick={() => decidir(item, false)}>
                            {esteOcupado ? <Loader2 size={15} className="apv-spin" /> : <X size={15} />}
                            {' '}Confirmar e {verbos.reprovar.toLowerCase()}
                          </button>
                        ) : (
                          <button type="button" className="apv-btn apv-btn-ok" disabled={esteOcupado}
                            onClick={() => aprovar(item)}>
                            {esteOcupado ? <Loader2 size={15} className="apv-spin" /> : <Check size={15} />}
                            {' '}{verbos.aprovar}
                          </button>
                        )}
                        <button type="button" className="apv-btn apv-btn-ghost" disabled={esteOcupado}
                          onClick={() => fechar(item.chave)}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {erros[item.chave] && <p className="apv-erro" role="alert">{erros[item.chave]}</p>}
                      <div className="apv-acoes">
                        <button type="button" className="apv-btn apv-btn-ok" disabled={esteOcupado}
                          onClick={() => aprovar(item)}>
                          {esteOcupado ? <Loader2 size={15} className="apv-spin" /> : <Check size={15} />}
                          {' '}{verbos.aprovar}
                        </button>
                        <button type="button" className="apv-btn apv-btn-nao" disabled={esteOcupado}
                          onClick={() => abrir(item.chave, 'reprovar')}>
                          <X size={15} /> {verbos.reprovar}
                        </button>
                        {item.observacaoAoAprovar && (
                          <button type="button" className="apv-link" disabled={esteOcupado}
                            onClick={() => abrir(item.chave, 'obs')}>
                            <MessageSquare size={14} /> Aprovar com observação
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </section>
        ))
      )}

      {/* Hora extra: aprovar é escolher o destino da hora — o mesmo modal do módulo. */}
      {destinoHe && (
        <DestinoHEModal
          solicitacao={destinoHe.raw}
          onClose={() => setDestinoHe(null)}
          onConfirm={async (extra) => {
            const item = destinoHe;
            setDestinoHe(null);
            await decidir(item, true, extra);
          }}
        />
      )}
    </div>
  );
}
