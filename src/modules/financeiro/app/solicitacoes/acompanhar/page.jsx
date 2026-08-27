import { useState, useEffect, useCallback, useRef } from 'react';
import { ClipboardCheck, Check, X, Loader2, ChevronDown, CheckCheck, AlertTriangle, Truck } from 'lucide-react';
import { useAuth } from '../../../../../contexts/AuthContext';
import { supabase } from '../../../../../services/supabase';
import { formatarMoeda } from '../../../../../utils/formatters';
import FluxoTimeline from '../../../../../components/Solicitacoes/FluxoTimeline';
import {
  etapaAtualFin, acaoDisponivelFin, resumoAndamentoFin, TIPO_LABEL_FIN,
} from '../../../../../config/aprovacaoFinanceiro';
import { categoriaLabel } from '../../../../../config/alcadas';
import { modalidadeCartaoLabel, PRAZO_CARTAO_FISICO } from '../../../../../config/financeiro';
import { meusPapeisAlcada, registrarAuditoria } from '../../../../../services/alcadas';
import { notificarAprovadorFin } from '../../../../../services/notificarAprovadorFin';
import '../../../../../components/UI/Components.css';

const TOM_BADGE = {
  pendente: { label: 'Em andamento', badge: 'pendente' },
  concluida: { label: 'Concluída', badge: 'aprovada' },
  reprovada: { label: 'Reprovada', badge: 'inativo' },
};

const SELECT = `
  id, numero, tipo, status, solicitante_id, nome_despesa, nome_completo, email, telefone,
  centro_custo, valor, periodo, vitalicio, periodo_inicio, periodo_fim, aplicacao, observacao, created_at,
  modalidade_cartao, endereco_entrega,
  categoria, dentro_orcamento, alcada_nivel_base, alcada_nivel_final, alcada_excecoes,
  etapas:solicitacoes_financeiro_etapas ( id, ordem, aprovador_id, papel, papel_codigo, tipo_etapa, status, justificativa, decidido_em )
`;

const fmtData = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—');

// Vigência: vitalício, range (cartão) ou data única (aumento de limite).
const vigencia = (s) => {
  if (s.vitalicio) return 'Vitalício';
  if (s.periodo_inicio || s.periodo_fim) return `${fmtData(s.periodo_inicio)} até ${fmtData(s.periodo_fim)}`;
  return fmtData(s.periodo);
};

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
  const [meusPapeis, setMeusPapeis] = useState([]);
  const seededRef = useRef(false);

  // Papéis do usuário: definem se ele pode agir em etapas de GRUPO
  // (aprovador_id null + papel_codigo), como Jurídico ou Conselho.
  useEffect(() => {
    if (!user?.id) return undefined;
    let vivo = true;
    meusPapeisAlcada(user.id, { financeiroRole: user.financeiroRole, rhDp: user.rhDp })
      .then((p) => { if (vivo) setMeusPapeis(p); });
    return () => { vivo = false; };
  }, [user]);

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
      lista.filter((s) => acaoDisponivelFin(user?.id, s.etapas, isFinAdmin, meusPapeis) !== null).map((s) => s.id)
    ));
  }, [lista, user?.id, isFinAdmin, meusPapeis]);

  // Trilha de auditoria (§6, pilar 4): quem agiu, quando, sobre que valor e
  // se havia exceção de alçada aplicada.
  const auditar = (sol, etapa, evento, observacao) => registrarAuditoria({
    modulo: 'financeiro',
    solicitacao_id: sol.id,
    numero: sol.numero,
    tipo: sol.tipo,
    evento,
    ator_id: user?.id || null,
    ator_nome: user?.nome || null,
    papel_codigo: etapa?.papel_codigo || null,
    valor: sol.valor ?? null,
    alcada_tabela: 'compras',
    nivel_base: sol.alcada_nivel_base ?? null,
    nivel_final: sol.alcada_nivel_final ?? null,
    excecoes: sol.alcada_excecoes || [],
    observacao: observacao || null,
  });

  const confirmarDecisao = async () => {
    if (!decisao) return;
    const { sol, modo } = decisao;
    const atual = etapaAtualFin(sol.etapas);
    if (!atual) return;
    const aprovando = modo === 'aprovar';
    const ehParecer = atual.tipo_etapa === 'parecer';
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
        auditar(sol, atual, 'reprovacao', comentario.trim() || `Reprovada na etapa "${atual.papel}"`);
      } else {
        auditar(sol, atual, ehParecer ? 'parecer' : 'aprovacao',
          comentario.trim() || `${ehParecer ? 'Parecer favorável' : 'Aprovada'} na etapa "${atual.papel}"`);
        // Aprovou: avisa quem passa a ser o responsável da vez.
        notificarAprovadorFin(sol.id);
      }
      setDecisao(null); setComentario('');
      await fetchLista();
    } catch (err) {
      console.error(err);
      alert(`Erro ao ${aprovando ? 'registrar a decisão' : 'reprovar'}. Tente novamente.`);
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
        auditar(sol, atual, 'execucao', 'Executada/concluída pelo Financeiro');
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
            const acao = acaoDisponivelFin(user?.id, s.etapas, isFinAdmin, meusPapeis);
            const aberto = expandido.has(s.id);
            const solic = nomes[s.solicitante_id] || '—';
            return (
              <div key={s.id} className={`fin-sol-card ${acao ? 'is-acao' : ''}`}>
                <button type="button" className="fin-sol-head" onClick={() => toggleCard(s.id)} aria-expanded={aberto}>
                  <ChevronDown size={16} className={`fin-sol-chevron ${aberto ? 'is-open' : ''}`} />
                  <span className="fin-sol-headtext">
                    <strong>{s.numero != null && `#${s.numero} · `}{s.tipo === 'aumento_limite' ? TIPO_LABEL_FIN[s.tipo] : modalidadeCartaoLabel(s.modalidade_cartao)} · {s.nome_despesa || `Solicitado por ${solic}`}</strong>
                    {!aberto && resumo.tom === 'pendente' && <span className="fin-sol-sub">{resumo.texto}</span>}
                  </span>
                  <span className={`badge ${tomB.badge}`}>{tomB.label}</span>
                </button>

                {aberto && (
                  <div className="fin-sol-body">
                    <div className="fin-sol-grid">
                      <div><span>Solicitante</span><strong>{solic}</strong></div>
                      <div><span>{s.tipo === 'aumento_limite' ? 'Cartão' : 'Descrição do cartão'}</span><strong>{s.nome_despesa || '—'}</strong></div>
                      {s.tipo !== 'aumento_limite' && (
                        <div><span>Tipo de cartão</span><strong>{modalidadeCartaoLabel(s.modalidade_cartao)}</strong></div>
                      )}
                      {s.modalidade_cartao === 'fisico' && s.tipo !== 'aumento_limite' && (
                        <div className="is-largo">
                          <span>Endereço de entrega</span>
                          <strong className="fin-endereco-valor">{s.endereco_entrega || '—'}</strong>
                        </div>
                      )}
                      {s.nome_completo && <div><span>Nome completo</span><strong>{s.nome_completo}</strong></div>}
                      {s.email && <div><span>E-mail</span><strong>{s.email}</strong></div>}
                      {s.telefone && <div><span>Telefone</span><strong>{s.telefone}</strong></div>}
                      <div><span>Centro de custo</span><strong>{s.centro_custo || '—'}</strong></div>
                      <div><span>{s.tipo === 'aumento_limite' ? 'Novo limite' : 'Valor'}</span><strong>{s.valor != null ? formatarMoeda(s.valor) : '—'}</strong></div>
                      <div><span>Vigência</span><strong>{vigencia(s)}</strong></div>
                      <div><span>Aplicação</span><strong>{Array.isArray(s.aplicacao) && s.aplicacao.length ? s.aplicacao.join(', ') : '—'}</strong></div>
                      {/* Campo aposentado: fica visível só nas solicitações antigas. */}
                      {s.categoria && <div><span>Categoria</span><strong>{categoriaLabel(s.categoria)}</strong></div>}
                      {/* Campo aposentado junto com a Categoria: some nas novas. */}
                      {s.dentro_orcamento != null && (
                        <div>
                          <span>Orçamento</span>
                          <strong>{s.dentro_orcamento ? 'Dentro do orçamento' : 'FORA do orçamento'}</strong>
                        </div>
                      )}
                      <div>
                        <span>Nível de alçada</span>
                        <strong>
                          {s.alcada_nivel_final == null ? '—' : `Nível ${s.alcada_nivel_final}`}
                          {s.alcada_nivel_base != null && s.alcada_nivel_final > s.alcada_nivel_base
                            && ` (elevado do ${s.alcada_nivel_base})`}
                        </strong>
                      </div>
                      <div><span>Aberta em</span><strong>{fmtData(s.created_at)}</strong></div>
                    </div>

                    {s.modalidade_cartao === 'fisico' && s.tipo !== 'aumento_limite' && (
                      <div className="alc-modificador" style={{ marginTop: 10 }}>
                        <Truck size={13} />
                        <span>{PRAZO_CARTAO_FISICO}</span>
                      </div>
                    )}

                    {/* §6, pilar 5 — exceção fica visível a quem decide, não só no log. */}
                    {Array.isArray(s.alcada_excecoes) && s.alcada_excecoes.length > 0 && (
                      <div className="alc-modificador" style={{ marginTop: 10 }}>
                        <AlertTriangle size={13} />
                        <span>Exceção de alçada: {s.alcada_excecoes.join(' · ')}</span>
                      </div>
                    )}

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
                      {/* §3.3 — parecer bloqueante: o fluxo não anda sem ele. */}
                      {acao === 'parecer' && (
                        <>
                          <button className="btn btn-success btn-sm" disabled={acaoId === s.id}
                            onClick={() => { setDecisao({ sol: s, modo: 'aprovar' }); setComentario(''); }}>
                            {acaoId === s.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Parecer favorável
                          </button>
                          <button className="btn btn-danger btn-sm" disabled={acaoId === s.id}
                            onClick={() => { setDecisao({ sol: s, modo: 'reprovar' }); setComentario(''); }}>
                            <X size={14} /> Parecer contrário
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
