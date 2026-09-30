import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Check, X, ExternalLink, Loader2, RefreshCw, AlertTriangle, CheckCircle2, Inbox,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import DestinoHEModal from '../../horas/app/components/DestinoHEModal';
import { listarPendencias, decidirPendencia } from '../lib/fontes';
import { agruparPorFonte, erroDaDecisao, nomeDaFonte, FONTES } from '../lib/central';
import '../aprovacoes.css';

const haQuanto = (iso) => {
  if (!iso) return '';
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias <= 0) return 'hoje';
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
};

/**
 * Central de Aprovações: tudo o que espera a decisão do usuário, em todos os
 * módulos. Pedido do André (29/09/2026) — o aviso chegava, mas a decisão exigia
 * entrar em cada módulo.
 *
 * Não tem dado próprio: lê de cada módulo e decide pela mesma função da tela
 * dele (lib/fontes.js), então a decisão já vale lá, com os mesmos avisos.
 */
export default function CentralAprovacoes() {
  const { user, reembolsoProfile } = useAuth();
  const ctx = useMemo(() => ({ user, reembolsoProfile }), [user, reembolsoProfile]);
  const [itens, setItens] = useState([]);
  const [falhas, setFalhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [comentarios, setComentarios] = useState({});
  const [erros, setErros] = useState({});
  const [ocupado, setOcupado] = useState('');
  const [aviso, setAviso] = useState('');
  const [destinoHe, setDestinoHe] = useState(null); // item de hora extra aprovando

  const carregar = useCallback(async () => {
    if (!user?.id) return;
    setCarregando(true);
    const r = await listarPendencias(ctx);
    setItens(r.itens);
    setFalhas(r.falhas);
    setCarregando(false);
  }, [ctx, user?.id]);

  useEffect(() => { carregar(); }, [carregar]);

  const visiveis = filtro ? itens.filter((i) => i.fonte === filtro) : itens;
  const grupos = agruparPorFonte(visiveis);
  const contagem = (chave) => itens.filter((i) => i.fonte === chave).length;

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

  return (
    <div className="apv-page">
      <header className="apv-header">
        <Link to="/home" className="apv-back"><ArrowLeft size={18} /> Portal</Link>
        <div className="apv-titulos">
          <h1>Aprovações</h1>
          <p>Tudo o que espera a sua decisão, em todos os módulos. O que você decide aqui já vale no módulo de origem.</p>
        </div>
        <button type="button" className="apv-btn apv-btn-ghost" onClick={carregar} disabled={carregando}>
          <RefreshCw size={15} /> Atualizar
        </button>
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
        <div className="apv-vazio"><Loader2 size={20} className="apv-spin" /> Buscando nos módulos…</div>
      ) : itens.length === 0 ? (
        <div className="apv-vazio"><Inbox size={22} /> Nada esperando a sua aprovação.</div>
      ) : (
        grupos.map((g) => (
          <section key={g.chave} className="apv-grupo">
            <h2>{g.modulo} <span className="apv-grupo-num">{g.itens.length}</span></h2>
            {g.itens.map((item) => {
              const verbos = item.verbos || { aprovar: 'Aprovar', reprovar: 'Reprovar' };
              const esteOcupado = ocupado === item.chave;
              return (
                <article key={item.chave} className="apv-item">
                  <div className="apv-item-cab">
                    <div>
                      <h3>{item.titulo}</h3>
                      <p className="apv-item-sub">
                        {item.pessoa && <>{item.pessoa} · </>}{haQuanto(item.quando)}
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

                  {item.direto ? (
                    <>
                      <label className="apv-rotulo" htmlFor={`apv-c-${item.chave}`}>
                        {item.observacaoAoAprovar
                          ? 'Observação (obrigatória para reprovar)'
                          : 'Motivo da reprovação'}
                      </label>
                      <textarea
                        id={`apv-c-${item.chave}`}
                        className="apv-textarea"
                        rows={2}
                        value={comentarios[item.chave] || ''}
                        onChange={(e) => setComentarios((c) => ({ ...c, [item.chave]: e.target.value }))}
                        placeholder={item.observacaoAoAprovar
                          ? 'Fica registrada no pedido, junto da sua decisão.'
                          : 'Só é usado se você reprovar.'}
                      />
                      {erros[item.chave] && <p className="apv-erro" role="alert">{erros[item.chave]}</p>}
                      <div className="apv-acoes">
                        <button type="button" className="apv-btn apv-btn-ok" disabled={esteOcupado}
                          onClick={() => (item.precisaDestino ? setDestinoHe(item) : decidir(item, true))}>
                          {esteOcupado ? <Loader2 size={15} className="apv-spin" /> : <Check size={15} />}
                          {' '}{verbos.aprovar}
                        </button>
                        <button type="button" className="apv-btn apv-btn-nao" disabled={esteOcupado}
                          onClick={() => decidir(item, false)}>
                          <X size={15} /> {verbos.reprovar}
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="apv-no-modulo">
                      <AlertTriangle size={14} /> {item.motivoAbrir}
                    </p>
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
