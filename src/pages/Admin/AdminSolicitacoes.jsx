import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import { formatarMoeda } from '../../utils/formatters';
import {
  FileText, Check, X, CheckCheck,
  Loader2, Filter, Trash2, Wrench, FastForward, History, ChevronDown,
} from 'lucide-react';
import FluxoTimeline from '../../components/Solicitacoes/FluxoTimeline';
import {
  APROVADORES, etapaAtual, acaoDisponivel, resumoAndamento, INICIATIVA_LABEL, TIPO_LABEL, TIPO_LABEL_CURTO,
} from '../../config/aprovacao';
import ModalRespostas, { DETALHE, buscarRespostas } from '../Gestor/requisicoes/ModalRespostas';
import BotaoPdfRequisicao from '../../components/BotaoPdfRequisicao';
import { notificarAprovadorSolic } from '../../services/notificarAprovadorSolic';
import '../../components/UI/Components.css';
import '../Gestor/requisicoes/Requisicoes.css';
import './Admin.css';
const TOM_BADGE = {
  pendente: { label: 'Em andamento', badge: 'pendente' },
  concluida: { label: 'Concluída', badge: 'aprovada' },
  reprovada: { label: 'Reprovada', badge: 'inativo' },
};

const SELECT_SOL = `
  id, tipo, status, iniciativa, gestor_id, colaborador_id, justificativa, salario_proposto, funcao_proposta, cargo_proposto, created_at, concluida_em,
  colaborador:colaborador_id ( id, nome, funcao, salario ),
  gestor:gestor_id ( nome ),
  etapas:solicitacoes_rh_etapas ( id, ordem, aprovador_id, papel, tipo_etapa, status, justificativa, decidido_em )
`;

export default function AdminSolicitacoes() {
  const { markSolicVisto } = useAuth();
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [acaoId, setAcaoId] = useState(null);
  const [decisao, setDecisao] = useState(null); // { sol, modo: 'aprovar' | 'reprovar' }
  const [comentario, setComentario] = useState('');
  const [verRespostas, setVerRespostas] = useState(null);
  const [solRespostas, setSolRespostas] = useState(null);
  const [expandido, setExpandido] = useState(() => new Set());
  const seededRef = useRef(false);

  const toggleCard = (id) => setExpandido((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Escape hatch (fluxo travado): reatribuir a etapa atual a outra pessoa.
  const [poolReatribuir, setPoolReatribuir] = useState([]); // colaboradores ativos (gestor/admin)
  const [reatribuirSol, setReatribuirSol] = useState(null);
  const [reatribuirId, setReatribuirId] = useState('');

  useEffect(() => {
    markSolicVisto?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    supabase
      .from('colaboradores')
      .select('id, nome, perfil')
      .in('perfil', ['gestor', 'admin'])
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => setPoolReatribuir(data || []));
  }, []);

  const fetchSolicitacoes = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('solicitacoes_rh')
        .select(SELECT_SOL)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSolicitacoes(data || []);
    } catch (err) {
      console.error('Erro ao buscar solicitações:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSolicitacoes();
    const handle = () => fetchSolicitacoes();
    window.addEventListener('solicitacoes_rh_atualizadas', handle);
    return () => window.removeEventListener('solicitacoes_rh_atualizadas', handle);
  }, [fetchSolicitacoes]);

  // Semeia UMA vez: abre expandidas as solicitações que aguardam a ação do admin.
  useEffect(() => {
    if (seededRef.current || solicitacoes.length === 0) return;
    seededRef.current = true;
    setExpandido(new Set(
      solicitacoes
        .filter((s) => acaoDisponivel(APROVADORES.admin, s.etapas) !== null)
        .map((s) => s.id)
    ));
  }, [solicitacoes]);

  // filtroStatus: 'todos' | 'pendente' | 'historico' (concluídas+reprovadas) | 'concluida' | 'reprovada'
  const filtradas = solicitacoes.filter((s) => {
    const matchStatus = filtroStatus === 'todos'
      ? true
      : filtroStatus === 'historico'
        ? s.status !== 'pendente'
        : s.status === filtroStatus;
    const matchTipo = filtroTipo === 'todos' || s.tipo === filtroTipo;
    return matchStatus && matchTipo;
  });

  const cont = (st) => solicitacoes.filter((s) => s.status === st).length;
  const aguardandoAdmin = solicitacoes.filter((s) => acaoDisponivel(APROVADORES.admin, s.etapas) !== null).length;

  const todasExpandidas = filtradas.length > 0 && filtradas.every((s) => expandido.has(s.id));
  const alternarTodas = () => setExpandido(todasExpandidas ? new Set() : new Set(filtradas.map((s) => s.id)));

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
      if (aprovando) {
        const { error } = await supabase
          .from('solicitacoes_rh_etapas')
          .update({ status: 'aprovada', justificativa: coment, decidido_em: agora })
          .eq('status', 'pendente')
          .eq('id', atual.id);
        if (error) throw error;
        notificarAprovadorSolic(sol.id);
      } else {
        const { error: e1 } = await supabase
          .from('solicitacoes_rh_etapas')
          .update({ status: 'reprovada', justificativa: coment, decidido_em: agora })
          .eq('id', atual.id);
        if (e1) throw e1;
        const { error: e2 } = await supabase
          .from('solicitacoes_rh')
          .update({ status: 'reprovada', updated_at: agora })
          .eq('id', sol.id);
        if (e2) throw e2;
      }
      setDecisao(null);
      setComentario('');
      await fetchSolicitacoes();
      window.dispatchEvent(new Event('solicitacoes_rh_atualizadas'));
    } catch (err) {
      console.error(err);
      alert(`Erro ao ${aprovando ? 'aprovar' : 'reprovar'}. Tente novamente.`);
    } finally {
      setAcaoId(null);
    }
  };

  const executar = async (sol) => {
    const atual = etapaAtual(sol.etapas);
    if (!atual) return;
    setAcaoId(sol.id);
    try {
      const agora = new Date().toISOString();
      // Guarda: só executa se a etapa ainda estiver pendente.
      const { data, error: e1 } = await supabase
        .from('solicitacoes_rh_etapas')
        .update({ status: 'executada', decidido_em: agora })
        .eq('id', atual.id)
        .eq('status', 'pendente')
        .select('id');
      if (e1) throw e1;
      if (!data || data.length === 0) {
        alert('Esta etapa já foi tratada. A lista será atualizada.');
        await fetchSolicitacoes();
        return;
      }
      const { error: e2 } = await supabase
        .from('solicitacoes_rh')
        .update({ status: 'concluida', concluida_em: agora, updated_at: agora })
        .eq('id', sol.id);
      if (e2) throw e2;
      await fetchSolicitacoes();
      window.dispatchEvent(new Event('solicitacoes_rh_atualizadas'));
    } catch (err) {
      console.error(err);
      alert('Erro ao executar. Tente novamente.');
    } finally {
      setAcaoId(null);
    }
  };

  // ===== Escape hatch (fluxo travado) =====
  // Reatribui a etapa atual a outra pessoa (ex.: o responsável foi inativado).
  const confirmarReatribuir = async () => {
    if (!reatribuirSol || !reatribuirId) return;
    const atual = etapaAtual(reatribuirSol.etapas);
    if (!atual) return;
    setAcaoId(reatribuirSol.id);
    try {
      const novo = poolReatribuir.find((c) => c.id === reatribuirId);
      const { error } = await supabase
        .from('solicitacoes_rh_etapas')
        .update({ aprovador_id: reatribuirId, papel: novo?.nome || 'Aprovador' })
        .eq('id', atual.id)
        .eq('status', 'pendente');
      if (error) throw error;
      notificarAprovadorSolic(reatribuirSol.id);
      setReatribuirSol(null);
      setReatribuirId('');
      await fetchSolicitacoes();
      window.dispatchEvent(new Event('solicitacoes_rh_atualizadas'));
    } catch (err) {
      console.error(err);
      alert('Erro ao reatribuir. Tente novamente.');
    } finally {
      setAcaoId(null);
    }
  };

  // Força o avanço da etapa atual (aprova manualmente, registrando que foi o admin).
  const forcarAvanco = async (sol) => {
    const atual = etapaAtual(sol.etapas);
    if (!atual) return;
    if (!window.confirm('Forçar o avanço desta etapa? Ela será marcada como aprovada pelo admin e o fluxo seguirá para a próxima.')) return;
    setAcaoId(sol.id);
    try {
      const agora = new Date().toISOString();
      const novoStatus = atual.tipo_etapa === 'execucao' ? 'executada' : 'aprovada';
      const { error: e1 } = await supabase
        .from('solicitacoes_rh_etapas')
        .update({ status: novoStatus, justificativa: 'Avanço forçado pelo admin', decidido_em: agora })
        .eq('id', atual.id)
        .eq('status', 'pendente');
      if (e1) throw e1;
      if (atual.tipo_etapa === 'execucao') {
        const { error: e2 } = await supabase
          .from('solicitacoes_rh')
          .update({ status: 'concluida', concluida_em: agora, updated_at: agora })
          .eq('id', sol.id);
        if (e2) throw e2;
      } else {
        notificarAprovadorSolic(sol.id);
      }
      await fetchSolicitacoes();
      window.dispatchEvent(new Event('solicitacoes_rh_atualizadas'));
    } catch (err) {
      console.error(err);
      alert('Erro ao forçar avanço. Tente novamente.');
    } finally {
      setAcaoId(null);
    }
  };

  const excluir = async (id) => {
    if (!window.confirm('Excluir esta solicitação permanentemente?')) return;
    setAcaoId(id);
    try {
      const { error } = await supabase.from('solicitacoes_rh').delete().eq('id', id);
      if (error) throw error;
      setSolicitacoes((prev) => prev.filter((s) => s.id !== id));
      window.dispatchEvent(new Event('solicitacoes_rh_atualizadas'));
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir. Tente novamente.');
    } finally {
      setAcaoId(null);
    }
  };

  const parseDesligamento = (just) => {
    if (just?.includes('Data solicitada para desligamento:')) {
      const m = just.match(/Data solicitada para desligamento: (.*?)\n\nJustificativa: (.*)/s);
      if (m) return { data: m[1], texto: m[2] };
    }
    return { data: null, texto: just };
  };

  return (
    <div className="admin-page animate-fade-in-up">
      <h1 className="page-title"><FileText size={28} /> Requisições DP</h1>
      <p className="page-subtitle">Aprove e execute as solicitações dos gestores conforme o fluxo de cada tipo.</p>

      {/* Resumo */}
      <div className="cards-grid" style={{ marginBottom: 'var(--space-xl)' }}>
        {[
          { key: 'todos', label: 'Total', count: solicitacoes.length, accent: 'accent' },
          { key: 'aguardando', label: 'Aguardando você', count: aguardandoAdmin, accent: 'warning' },
          { key: 'concluida', label: 'Concluídas', count: cont('concluida'), accent: 'success' },
          { key: 'reprovada', label: 'Reprovadas', count: cont('reprovada'), accent: 'danger' },
        ].map((c) => (
          <div
            key={c.key}
            className={`stat-card ${c.accent} ${filtroStatus === c.key ? 'is-active' : ''}`}
            onClick={() => setFiltroStatus(c.key === 'aguardando' ? 'todos' : c.key)}
            style={{ cursor: 'pointer' }}
          >
            <div className="stat-card-value">{c.count}</div>
            <div className="stat-card-label">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Abas: fila ativa x histórico (concluídas + reprovadas) */}
      <div className="req-tabs" style={{ marginTop: 0 }}>
        {[
          { key: 'todos', label: 'Todas', icone: FileText },
          { key: 'pendente', label: 'Em andamento', icone: Loader2 },
          { key: 'historico', label: 'Histórico', icone: History },
        ].map((t) => {
          const ativa = t.key === 'historico'
            ? ['historico', 'concluida', 'reprovada'].includes(filtroStatus)
            : filtroStatus === t.key;
          const Icone = t.icone;
          return (
            <button key={t.key} type="button" className={`req-tab ${ativa ? 'active' : ''}`} onClick={() => setFiltroStatus(t.key)}>
              <Icone size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="table-container">
        <div className="table-header">
          <div className="table-header-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            Solicitações
            {filtradas.length > 1 && (
              <button className="btn btn-outline btn-sm" onClick={alternarTodas}>
                {todasExpandidas ? 'Recolher todas' : 'Expandir todas'}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center', flexWrap: 'wrap' }}>
            <Filter size={15} color="var(--color-text-muted)" />
            {['todos', ...Object.keys(TIPO_LABEL)].map((t) => (
              <button key={t} className={`filter-chip ${filtroTipo === t ? 'active' : ''}`} onClick={() => setFiltroTipo(t)}
                title={t === 'todos' ? undefined : TIPO_LABEL[t]}>
                {t === 'todos' ? 'Todos os tipos' : TIPO_LABEL_CURTO[t]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}><Loader2 size={24} className="animate-spin" /></div>
        ) : filtradas.length === 0 ? (
          <div className="table-empty" style={{ padding: 'var(--space-3xl)' }}>Nenhuma solicitação encontrada.</div>
        ) : (
          <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {filtradas.map((s) => {
              const resumo = resumoAndamento(s, s.etapas);
              const tomB = TOM_BADGE[resumo.tom] || TOM_BADGE.pendente;
              const acao = acaoDisponivel(APROVADORES.admin, s.etapas); // 'aprovacao' | 'execucao' | null
              const det = s.tipo === 'desligamento' ? parseDesligamento(s.justificativa) : { data: null, texto: s.justificativa };
              return (
                <div key={s.id} className={`sol-card ${acao ? 'sol-card--acao' : ''}`}>
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
                        {TIPO_LABEL[s.tipo]} · {s.colaborador?.nome || (s.gestor?.nome ? `Solicitado por ${s.gestor.nome}` : '—')}
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
                      <div className="sol-card-colab">{s.colaborador?.nome || '—'}</div>
                      <div className="sol-card-tipo">
                        {TIPO_LABEL[s.tipo]}
                        {s.iniciativa && <span className="sol-card-iniciativa"> · {INICIATIVA_LABEL[s.iniciativa]}</span>}
                        {s.gestor?.nome && <span> · solicitado por {s.gestor.nome}</span>}
                        {s.created_at && <span className="sol-card-iniciativa"> · Aberta em {new Date(s.created_at).toLocaleDateString('pt-BR')}</span>}
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

                  <div className="sol-card-actions">
                    <BotaoPdfRequisicao sol={s} nomeColaborador={s.colaborador?.nome} nomeSolicitante={s.gestor?.nome} />
                    {DETALHE[s.tipo] && (
                      <button className="btn btn-outline btn-sm" disabled={acaoId === s.id}
                        onClick={async () => { setSolRespostas(s); setVerRespostas(await buscarRespostas(s)); }}>
                        <FileText size={14} /> Ver respostas
                      </button>
                    )}
                    {acao === 'aprovacao' && (
                      <>
                        <button className="btn btn-success btn-sm" disabled={acaoId === s.id} onClick={() => { setDecisao({ sol: s, modo: 'aprovar' }); setComentario(''); }}>
                          {acaoId === s.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Aprovar
                        </button>
                        <button className="btn btn-danger btn-sm" disabled={acaoId === s.id} onClick={() => { setDecisao({ sol: s, modo: 'reprovar' }); setComentario(''); }}>
                          <X size={14} /> Reprovar
                        </button>
                      </>
                    )}
                    {acao === 'execucao' && (
                      <button className="btn btn-primary btn-sm" disabled={acaoId === s.id} onClick={() => executar(s)}>
                        {acaoId === s.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />} Executar / Concluir
                      </button>
                    )}
                    {s.status === 'pendente' && (
                      <>
                        <button className="btn btn-outline btn-sm" title="Reatribuir a etapa atual a outra pessoa" disabled={acaoId === s.id} onClick={() => { setReatribuirSol(s); setReatribuirId(''); }}>
                          <Wrench size={14} /> Reatribuir
                        </button>
                        <button className="btn btn-outline btn-sm" title="Forçar avanço da etapa atual" disabled={acaoId === s.id} onClick={() => forcarAvanco(s)}>
                          <FastForward size={14} /> Forçar avanço
                        </button>
                      </>
                    )}
                    <button className="btn btn-ghost btn-sm" title="Excluir" disabled={acaoId === s.id} onClick={() => excluir(s.id)} style={{ color: 'var(--color-danger)', marginLeft: 'auto' }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                  </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ModalRespostas
        respostas={verRespostas}
        sol={solRespostas}
        nomeColaborador={solRespostas?.colaborador?.nome}
        nomeSolicitante={solRespostas?.gestor?.nome}
        onClose={() => { setVerRespostas(null); setSolRespostas(null); }}
      />

      {/* Modal de decisão (aprovar / reprovar) com comentário opcional */}
      {decisao && (() => {
        const aprovando = decisao.modo === 'aprovar';
        return (
        <div className="modal-overlay" onClick={() => setDecisao(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{aprovando ? 'Aprovar solicitação' : 'Reprovar solicitação'}</span>
              <button className="modal-close" onClick={() => setDecisao(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 'var(--space-md)', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                {aprovando
                  ? 'A solicitação seguirá para a próxima etapa do fluxo. Você pode deixar um comentário, se quiser.'
                  : <>A solicitação será <strong>encerrada como Reprovada</strong> e todos da cadeia verão o comentário.</>}
              </p>
              <div className="form-group">
                <label className="form-label">Comentário (opcional)</label>
                <textarea
                  className="form-input" rows={3} style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  placeholder={aprovando ? 'Adicione um comentário, se quiser...' : 'Explique o motivo da reprovação (opcional)...'}
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                />
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

      {/* Modal de reatribuição (escape hatch) */}
      {reatribuirSol && (
        <div className="modal-overlay" onClick={() => setReatribuirSol(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Reatribuir etapa atual</span>
              <button className="modal-close" onClick={() => setReatribuirSol(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 'var(--space-md)', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                A etapa atual passará a ser responsabilidade da pessoa escolhida. Use quando o responsável saiu ou foi inativado.
              </p>
              <div className="form-group">
                <label className="form-label">Novo responsável <span className="required">*</span></label>
                <select className="form-select" value={reatribuirId} onChange={(e) => setReatribuirId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {poolReatribuir.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}{c.perfil === 'admin' ? ' (Admin)' : ''}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setReatribuirSol(null)}>Cancelar</button>
              <button className="btn btn-primary" disabled={!reatribuirId || acaoId === reatribuirSol.id} onClick={confirmarReatribuir}>
                {acaoId === reatribuirSol.id ? 'Reatribuindo...' : <><Wrench size={16} /> Confirmar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
