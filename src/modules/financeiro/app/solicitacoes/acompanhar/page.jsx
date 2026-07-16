import { useState, useEffect, useCallback, useRef } from 'react';
import { ClipboardCheck, Check, X, Loader2, ChevronDown, CheckCheck } from 'lucide-react';
import { useAuth } from '../../../../../contexts/AuthContext';
import { supabase } from '../../../../../services/supabase';
import { formatarMoeda } from '../../../../../utils/formatters';
import FluxoTimeline from '../../../../../components/Solicitacoes/FluxoTimeline';
import {
  etapaAtualFin, acaoDisponivelFin, resumoAndamentoFin, TIPO_LABEL_FIN,
} from '../../../../../config/aprovacaoFinanceiro';
import { notificarAprovadorFin } from '../../../../../services/notificarAprovadorFin';
import '../../../../../components/UI/Components.css';

const TOM_BADGE = {
  pendente: { label: 'Em andamento', badge: 'pendente' },
  concluida: { label: 'Concluída', badge: 'aprovada' },
  reprovada: { label: 'Reprovada', badge: 'inativo' },
};

const SELECT = `
  id, numero, tipo, status, solicitante_id, nome_despesa, centro_custo, valor, periodo, cnae, observacao, created_at,
  etapas:solicitacoes_financeiro_etapas ( id, ordem, aprovador_id, papel, tipo_etapa, status, justificativa, decidido_em )
`;

const fmtData = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—');

export default function AcompanharFin() {
  const { user } = useAuth();
  const isFinAdmin = user?.financeiroRole === 'admin';
  const [lista, setLista] = useState([]);
  const [nomes, setNomes] = useState({});
  const [loading, setLoading] = useState(true);
  const [acaoId, setAcaoId] = useState(null);
  const [decisao, setDecisao] = useState(null);   // { sol, modo }
  const [comentario, setComentario] = useState('');
  const [expandido, setExpandido] = useState(() => new Set());
  const seededRef = useRef(false);

  const toggleCard = (id) => setExpandido((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const fetchLista = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    // A RLS já limita ao que o usuário pode ver (próprias + onde aprova + admin vê tudo).
    const { data } = await supabase
      .from('solicitacoes_financeiro')
      .select(SELECT)
      .order('created_at', { ascending: false });
    const rows = data || [];
    const ids = [...new Set(rows.map((s) => s.solicitante_id).filter(Boolean))];
    let nomesMap = {};
    if (ids.length) {
      const { data: cols } = await supabase.rpc('nomes_colaboradores', { p_ids: ids });
      nomesMap = Object.fromEntries((cols || []).map((c) => [c.id, c.nome]));
    }
    setNomes(nomesMap);
    setLista(rows);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchLista(); }, [fetchLista]);
  useEffect(() => {
    const h = () => fetchLista();
    window.addEventListener('solicitacoes_financeiro_atualizadas', h);
    return () => window.removeEventListener('solicitacoes_financeiro_atualizadas', h);
  }, [fetchLista]);

  // Abre expandidas, uma vez, as que aguardam ação deste usuário.
  useEffect(() => {
    if (seededRef.current || lista.length === 0) return;
    seededRef.current = true;
    setExpandido(new Set(
      lista.filter((s) => acaoDisponivelFin(user?.id, s.etapas, isFinAdmin) !== null).map((s) => s.id)
    ));
  }, [lista, user?.id, isFinAdmin]);

  const confirmarDecisao = async () => {
    if (!decisao) return;
    const { sol, modo } = decisao;
    const atual = etapaAtualFin(sol.etapas);
    if (!atual) return;
    const aprovando = modo === 'aprovar';
    const agora = new Date().toISOString();
    setAcaoId(sol.id);
    try {
      const { data, error } = await supabase
        .from('solicitacoes_financeiro_etapas')
        .update({ status: aprovando ? 'aprovada' : 'reprovada', justificativa: comentario.trim() || null, decidido_em: agora })
        .eq('id', atual.id)
        .eq('status', 'pendente')
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        alert('Esta etapa já foi tratada. A lista será atualizada.');
      } else if (!aprovando) {
        await supabase.from('solicitacoes_financeiro').update({ status: 'reprovada', updated_at: agora }).eq('id', sol.id);
      } else {
        // Aprovou: avisa quem passa a ser o responsável da vez.
        notificarAprovadorFin(sol.id);
      }
      setDecisao(null); setComentario('');
      await fetchLista();
    } catch (err) {
      console.error(err);
      alert(`Erro ao ${aprovando ? 'aprovar' : 'reprovar'}. Tente novamente.`);
    } finally {
      setAcaoId(null);
    }
  };

  const executar = async (sol) => {
    const atual = etapaAtualFin(sol.etapas);
    if (!atual) return;
    setAcaoId(sol.id);
    try {
      const agora = new Date().toISOString();
      const { data, error } = await supabase
        .from('solicitacoes_financeiro_etapas')
        .update({ status: 'executada', decidido_em: agora })
        .eq('id', atual.id)
        .eq('status', 'pendente')
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        alert('Esta etapa já foi tratada. A lista será atualizada.');
      } else {
        await supabase.from('solicitacoes_financeiro')
          .update({ status: 'concluida', concluida_em: agora, updated_at: agora }).eq('id', sol.id);
      }
      await fetchLista();
    } catch (err) {
      console.error(err);
      alert('Erro ao executar. Tente novamente.');
    } finally {
      setAcaoId(null);
    }
  };

  return (
    <div className="fin-page">
      <h1 className="fin-title"><ClipboardCheck size={26} /> Aprovar / Acompanhar</h1>
      <p className="fin-sub">Solicitações que você criou ou nas quais participa da cadeia de aprovação.</p>

      {loading ? (
        <div className="fin-empty">Carregando...</div>
      ) : lista.length === 0 ? (
        <div className="fin-empty">Nenhuma solicitação para acompanhar.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
          {lista.map((s) => {
            const resumo = resumoAndamentoFin(s, s.etapas);
            const tomB = TOM_BADGE[resumo.tom] || TOM_BADGE.pendente;
            const acao = acaoDisponivelFin(user?.id, s.etapas, isFinAdmin);
            const aberto = expandido.has(s.id);
            const solic = nomes[s.solicitante_id] || '—';
            return (
              <div key={s.id} className={`fin-sol-card ${acao ? 'is-acao' : ''}`}>
                <button type="button" className="fin-sol-head" onClick={() => toggleCard(s.id)} aria-expanded={aberto}>
                  <ChevronDown size={16} className={`fin-sol-chevron ${aberto ? 'is-open' : ''}`} />
                  <span className="fin-sol-headtext">
                    <strong>{s.numero != null && `#${s.numero} · `}{TIPO_LABEL_FIN[s.tipo] || s.tipo} · {s.nome_despesa || `Solicitado por ${solic}`}</strong>
                    {!aberto && resumo.tom === 'pendente' && <span className="fin-sol-sub">{resumo.texto}</span>}
                  </span>
                  <span className={`badge ${tomB.badge}`}>{tomB.label}</span>
                </button>

                {aberto && (
                  <div className="fin-sol-body">
                    <div className="fin-sol-grid">
                      <div><span>Solicitante</span><strong>{solic}</strong></div>
                      <div><span>Nome da despesa/compra</span><strong>{s.nome_despesa || '—'}</strong></div>
                      <div><span>Centro de custo</span><strong>{s.centro_custo || '—'}</strong></div>
                      <div><span>Valor</span><strong>{s.valor != null ? formatarMoeda(s.valor) : '—'}</strong></div>
                      <div><span>Período</span><strong>{fmtData(s.periodo)}</strong></div>
                      <div><span>CNAE</span><strong>{s.cnae || '—'}</strong></div>
                      <div><span>Aberta em</span><strong>{fmtData(s.created_at)}</strong></div>
                    </div>
                    {s.observacao && <div className="fin-sol-obs">{s.observacao}</div>}

                    <div className={`fin-sol-resumo tom-${resumo.tom}`}>{resumo.texto}</div>
                    <FluxoTimeline etapas={s.etapas} />

                    <div className="fin-sol-actions">
                      {acao === 'aprovacao' && (
                        <>
                          <button className="btn btn-success btn-sm" disabled={acaoId === s.id}
                            onClick={() => { setDecisao({ sol: s, modo: 'aprovar' }); setComentario(''); }}>
                            {acaoId === s.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Aprovar
                          </button>
                          <button className="btn btn-danger btn-sm" disabled={acaoId === s.id}
                            onClick={() => { setDecisao({ sol: s, modo: 'reprovar' }); setComentario(''); }}>
                            <X size={14} /> Reprovar
                          </button>
                        </>
                      )}
                      {/* O Financeiro decide aqui: gera o cartão (executa) ou recusa. */}
                      {acao === 'execucao' && (
                        <>
                          <button className="btn btn-primary btn-sm" disabled={acaoId === s.id} onClick={() => executar(s)}>
                            {acaoId === s.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />} Executar / Concluir
                          </button>
                          <button className="btn btn-danger btn-sm" disabled={acaoId === s.id}
                            onClick={() => { setDecisao({ sol: s, modo: 'reprovar' }); setComentario(''); }}>
                            <X size={14} /> Reprovar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
                <p style={{ marginBottom: 'var(--space-md)', color: 'var(--color-text-secondary)', fontSize: 13 }}>
                  {aprovando
                    ? 'A solicitação seguirá para a próxima etapa do fluxo.'
                    : 'A solicitação será encerrada como Reprovada. Todos da cadeia verão o comentário.'}
                </p>
                <div className="form-group">
                  <label className="form-label">Comentário (opcional)</label>
                  <textarea className="form-input" rows={3} style={{ resize: 'vertical', fontFamily: 'inherit' }}
                    value={comentario} onChange={(e) => setComentario(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setDecisao(null)}>Cancelar</button>
                <button className={`btn ${aprovando ? 'btn-success' : 'btn-danger'}`} disabled={acaoId === decisao.sol.id} onClick={confirmarDecisao}>
                  {acaoId === decisao.sol.id ? 'Processando...' : (aprovando ? 'Confirmar aprovação' : 'Confirmar reprovação')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
