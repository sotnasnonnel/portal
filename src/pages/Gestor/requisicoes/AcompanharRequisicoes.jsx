import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../services/supabase';
import { formatarMoeda, parseDesligamento } from '../../../utils/formatters';
import { Check, X, Loader2, ClipboardCheck, FileText, ChevronDown, Filter } from 'lucide-react';
import FluxoTimeline from '../../../components/Solicitacoes/FluxoTimeline';
import {
  etapaAtual, acaoDisponivel, resumoAndamento,
  INICIATIVA_LABEL, TIPO_LABEL, TIPO_LABEL_CURTO,
} from '../../../config/aprovacao';
import ModalRespostas, { DETALHE, buscarRespostas } from './ModalRespostas';
import RequisicoesRh from './RequisicoesRh';
import BotaoPdfRequisicao from '../../../components/BotaoPdfRequisicao';
import '../../../components/UI/Components.css';
import '../Gestor.css';

const TOM_BADGE = {
  pendente: { label: 'Em andamento', badge: 'pendente' },
  concluida: { label: 'Concluída', badge: 'aprovada' },
  reprovada: { label: 'Reprovada', badge: 'inativo' },
};

const SELECT_SOL = `
  id, tipo, status, iniciativa, gestor_id, colaborador_id, justificativa, salario_proposto, funcao_proposta, cargo_proposto, created_at,
  colaborador:colaborador_id ( nome, funcao, salario ),
  gestor:gestor_id ( nome ),
  etapas:solicitacoes_rh_etapas ( id, ordem, aprovador_id, papel, tipo_etapa, status, justificativa, decidido_em )
`;

export default function AcompanharRequisicoes() {
  const { user, markSolicVisto } = useAuth();
  const [participa, setParticipa] = useState([]);
  const [nomes, setNomes] = useState({}); // id -> nome (solicitante/colaborador), via RPC
  const [loading, setLoading] = useState(true);
  const [acaoId, setAcaoId] = useState(null);
  const [decisao, setDecisao] = useState(null); // { sol, modo: 'aprovar' | 'reprovar' }
  const [comentario, setComentario] = useState('');
  const [verRespostas, setVerRespostas] = useState(null);
  const [solRespostas, setSolRespostas] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState('todos');

  const abrirRespostas = async (sol) => { setSolRespostas(sol); setVerRespostas(await buscarRespostas(sol)); };

  const [expandido, setExpandido] = useState(() => new Set());
  const seededRef = useRef(false);

  const toggleCard = (id) => setExpandido((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const filtradas = filtroTipo === 'todos' ? participa : participa.filter((s) => s.tipo === filtroTipo);
  const todasExpandidas = filtradas.length > 0 && filtradas.every((s) => expandido.has(s.id));
  const alternarTodas = () => setExpandido(todasExpandidas ? new Set() : new Set(filtradas.map((s) => s.id)));

  const fetchParticipa = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('solicitacoes_rh')
      .select(SELECT_SOL)
      .order('created_at', { ascending: false });
    const veTudo = user.rhDp || user.perfil === 'admin';
    const minhas = veTudo
      ? (data || [])
      : (data || []).filter((s) => s.gestor_id === user.id || (s.etapas || []).some((e) => e.aprovador_id === user.id));
    // Resolve nomes de solicitante e colaborador via RPC: a RLS de colaboradores
    // esconde quem não é superior, então o join gestor/colaborador vem nulo para
    // quem só aprova. A RPC SECURITY DEFINER devolve só (id, nome).
    const ids = [...new Set(minhas.flatMap((s) => [s.gestor_id, s.colaborador_id]).filter(Boolean))];
    let nomesMap = {};
    if (ids.length) {
      const { data: cols } = await supabase.rpc('nomes_colaboradores', { p_ids: ids });
      nomesMap = Object.fromEntries((cols || []).map((c) => [c.id, c.nome]));
    }
    setNomes(nomesMap);
    setParticipa(minhas);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchParticipa(); }, [fetchParticipa]);

  // Semeia UMA vez: abre expandidas as requisições que aguardam a ação deste usuário.
  useEffect(() => {
    if (seededRef.current || participa.length === 0) return;
    seededRef.current = true;
    setExpandido(new Set(
      participa
        .filter((s) => acaoDisponivel(user?.id, s.etapas) === 'aprovacao')
        .map((s) => s.id)
    ));
  }, [participa, user?.id]);

  useEffect(() => {
    markSolicVisto?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmarDecisao = async () => {
    if (!decisao) return;
    const { sol, modo } = decisao;
    const atual = etapaAtual(sol.etapas);
    if (!atual) return;
    const aprovando = modo === 'aprovar';
    const coment = comentario.trim() || null;
    const agora = new Date().toISOString();
    setAcaoId(sol.id);
    try {
      const { data, error } = await supabase
        .from('solicitacoes_rh_etapas')
        .update({
          status: aprovando ? 'aprovada' : 'reprovada',
          justificativa: coment,
          decidido_em: agora,
        })
        .eq('id', atual.id)
        .eq('aprovador_id', user.id)
        .eq('status', 'pendente')
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        alert('Esta etapa já foi tratada por outra pessoa. A lista será atualizada.');
        setDecisao(null);
        setComentario('');
        await fetchParticipa();
        return;
      }
      if (!aprovando) {
        const { error: e2 } = await supabase
          .from('solicitacoes_rh')
          .update({ status: 'reprovada', updated_at: agora })
          .eq('id', sol.id);
        if (e2) throw e2;
      }
      setDecisao(null);
      setComentario('');
      await fetchParticipa();
      window.dispatchEvent(new Event('solicitacoes_rh_atualizadas'));
    } catch (err) {
      console.error(err);
      alert(`Erro ao ${aprovando ? 'aprovar' : 'reprovar'}. Tente novamente.`);
    } finally {
      setAcaoId(null);
    }
  };

  // RH/DP: visão organizada (filtros por status + lista + modal do fluxo), somente leitura.
  if (user?.rhDp) {
    return <RequisicoesRh participa={participa} nomes={nomes} loading={loading} />;
  }

  return (
    <div className="gestor-page animate-fade-in-up">
      <h1 className="page-title"><ClipboardCheck size={28} /> Aprovar / Acompanhar</h1>
      <p className="page-subtitle">Requisições que você criou ou nas quais participa da cadeia de aprovação.</p>

      <div className="table-container" style={{ marginTop: 'var(--space-md)' }}>
        <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
          <div className="table-header-title"><ClipboardCheck size={16} /> Requisições que você participa</div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center', flexWrap: 'wrap' }}>
            {participa.length > 0 && (
              <>
                <Filter size={15} color="var(--color-text-muted)" />
                {['todos', ...Object.keys(TIPO_LABEL)].map((t) => (
                  <button key={t} type="button" className={`filter-chip ${filtroTipo === t ? 'active' : ''}`}
                    onClick={() => setFiltroTipo(t)}
                    title={t === 'todos' ? undefined : TIPO_LABEL[t]}>
                    {t === 'todos' ? 'Todos os tipos' : TIPO_LABEL_CURTO[t]}
                  </button>
                ))}
              </>
            )}
            {participa.length > 1 && (
              <button className="btn btn-outline btn-sm" onClick={alternarTodas}>
                {todasExpandidas ? 'Recolher todas' : 'Expandir todas'}
              </button>
            )}
          </div>
        </div>
        {loading ? (
          <div style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>Carregando...</div>
        ) : participa.length === 0 ? (
          <div className="table-empty" style={{ padding: 'var(--space-3xl)' }}>Nenhuma requisição para acompanhar.</div>
        ) : filtradas.length === 0 ? (
          <div className="table-empty" style={{ padding: 'var(--space-3xl)' }}>Nenhuma requisição desse tipo.</div>
        ) : (
          <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {filtradas.map((s) => {
              const resumo = resumoAndamento(s, s.etapas);
              const tomB = TOM_BADGE[resumo.tom] || TOM_BADGE.pendente;
              const podeAprovar = !user?.rhDp && acaoDisponivel(user?.id, s.etapas) === 'aprovacao';
              const det = s.tipo === 'desligamento' ? parseDesligamento(s.justificativa) : { data: null, texto: s.justificativa };
              const nomeSolic = nomes[s.gestor_id] || s.gestor?.nome || '—';
              const nomeColab = nomes[s.colaborador_id] || s.colaborador?.nome || '';
              return (
                <div key={s.id} className={`sol-card ${podeAprovar ? 'sol-card--acao' : ''}`}>
                  <button
                    type="button"
                    className="sol-card-header"
                    aria-expanded={expandido.has(s.id)}
                    aria-controls={`sol-body-${s.id}`}
                    onClick={() => toggleCard(s.id)}
                  >
                    <ChevronDown size={16} aria-hidden className={`sol-card-chevron ${expandido.has(s.id) ? 'is-open' : ''}`} />
                    <span className="sol-card-headtext">
                      <span className="sol-card-headline sol-card-colab">
                        {TIPO_LABEL[s.tipo]} · {nomeColab || `Solicitado por ${nomeSolic}`}
                      </span>
                      {!expandido.has(s.id) && resumo.tom === 'pendente' && (
                        <span className="sol-card-headsub">{resumo.texto}</span>
                      )}
                    </span>
                    <span className={`badge ${tomB.badge}`}>{tomB.label}</span>
                  </button>

                  {expandido.has(s.id) && (
                  <div id={`sol-body-${s.id}`} className="sol-card-body">
                  <div className="sol-card-top">
                    <div>
                      <div className="sol-card-colab">{nomeColab || `Solicitado por ${nomeSolic}`}</div>
                      <div className="sol-card-tipo">
                        {TIPO_LABEL[s.tipo]}
                        {s.iniciativa && <span className="sol-card-iniciativa"> · {INICIATIVA_LABEL[s.iniciativa]}</span>}
                        {nomeColab && <span className="sol-card-iniciativa"> · Solicitado por {nomeSolic}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="sol-card-info">
                    {s.tipo === 'aumento_salario' && s.salario_proposto != null && (
                      <span>Valor: {formatarMoeda(s.colaborador?.salario)} → <strong style={{ color: 'var(--color-success)' }}>{formatarMoeda(s.salario_proposto)}</strong></span>
                    )}
                    {s.tipo === 'aumento_salario' && s.funcao_proposta && (
                      <span>Função: {s.colaborador?.funcao || '—'} → <strong style={{ color: 'var(--color-success)' }}>{s.funcao_proposta}</strong></span>
                    )}
                    {s.tipo === 'aumento_salario' && s.cargo_proposto && (
                      <span>Cargo: <strong style={{ color: 'var(--color-success)' }}>{s.cargo_proposto}</strong></span>
                    )}
                    {s.tipo === 'desligamento' && det.data && (
                      <span>Desligamento sugerido: <strong style={{ color: 'var(--color-danger)' }}>{det.data}</strong></span>
                    )}
                  </div>
                  {det.texto && <div className="sol-card-just">{det.texto}</div>}

                  <div className={`sol-card-resumo tom-${resumo.tom}`}>{resumo.texto}</div>

                  <FluxoTimeline etapas={s.etapas} />

                  {(
                    <div className="sol-card-actions">
                      <BotaoPdfRequisicao sol={s} nomeColaborador={nomeColab} nomeSolicitante={nomeSolic} />
                      {DETALHE[s.tipo] && (
                        <button className="btn btn-outline btn-sm" onClick={() => abrirRespostas(s)}>
                          <FileText size={14} /> Ver respostas
                        </button>
                      )}
                      {podeAprovar && (
                        <>
                          <button className="btn btn-success btn-sm" disabled={acaoId === s.id} onClick={() => { setDecisao({ sol: s, modo: 'aprovar' }); setComentario(''); }}>
                            {acaoId === s.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Aprovar
                          </button>
                          <button className="btn btn-danger btn-sm" disabled={acaoId === s.id} onClick={() => { setDecisao({ sol: s, modo: 'reprovar' }); setComentario(''); }}>
                            <X size={14} /> Reprovar
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {decisao && (() => {
        const aprovando = decisao.modo === 'aprovar';
        return (
        <div className="modal-overlay" onClick={() => setDecisao(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{aprovando ? 'Aprovar requisição' : 'Reprovar requisição'}</span>
              <button className="modal-close" onClick={() => setDecisao(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 'var(--space-md)', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                {aprovando
                  ? 'A requisição seguirá para a próxima etapa do fluxo. Você pode deixar um comentário, se quiser.'
                  : <>A requisição será <strong>encerrada como Reprovada</strong> e todos da cadeia verão o comentário.</>}
              </p>
              <div className="form-group">
                <label className="form-label">Comentário (opcional)</label>
                <textarea className="form-input" rows={3} style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  placeholder={aprovando ? 'Adicione um comentário, se quiser...' : 'Explique o motivo da reprovação (opcional)...'}
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDecisao(null)}>Cancelar</button>
              <button className={`btn ${aprovando ? 'btn-success' : 'btn-danger'}`} disabled={acaoId === decisao.sol.id} onClick={confirmarDecisao}>
                {acaoId === decisao.sol.id
                  ? (aprovando ? 'Aprovando...' : 'Reprovando...')
                  : (aprovando ? <><Check size={16} /> Confirmar aprovação</> : <><X size={16} /> Confirmar reprovação</>)}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      <ModalRespostas
        respostas={verRespostas}
        sol={solRespostas}
        nomeColaborador={solRespostas ? (nomes[solRespostas.colaborador_id] || solRespostas.colaborador?.nome) : undefined}
        nomeSolicitante={solRespostas ? (nomes[solRespostas.gestor_id] || solRespostas.gestor?.nome) : undefined}
        onClose={() => { setVerRespostas(null); setSolRespostas(null); }}
      />
    </div>
  );
}
