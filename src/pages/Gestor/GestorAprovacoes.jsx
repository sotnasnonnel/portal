import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { getEquipeIds } from '../../services/equipe';
import { formatarData, getStatusCalculado } from '../../utils/formatters';
import { ClipboardCheck, Check, X, Eye, Filter, Loader2, AlertCircle, Clock, RefreshCw, ArrowRight } from 'lucide-react';
import '../../components/UI/Components.css';
import './Gestor.css';

export default function GestorAprovacoes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const filtrosValidos = ['todos', 'pendente', 'aprovada', 'reprovada'];
  const statusParam = searchParams.get('status');
  const filtroStatus = statusParam && filtrosValidos.includes(statusParam) ? statusParam : 'pendente';

  const fetchSolicitacoes = async () => {
    setLoading(true);
    try {
      const idsEquipe = await getEquipeIds();
      const { data: cols, error: colsError } = idsEquipe.length
        ? await supabase.from('colaboradores').select('id, nome').in('id', idsEquipe)
        : { data: [], error: null };

      if (colsError) throw colsError;
      const ids = cols.map((c) => c.id);

      const { data: cics, error: cicsError } = await supabase
        .from('ciclos_ausencia')
        .select('*')
        .in('colaborador_id', ids);

      if (cicsError) throw cicsError;

      const mapped = (cics || []).map((a) => {
        const colab = cols.find((c) => c.id === a.colaborador_id);
        const calc = getStatusCalculado({
          ...a,
          status_original: a.status_atual,
          inicio_pa: a.inicio_periodo_aquisitivo,
          fim_pa: a.fim_periodo_aquisitivo,
          limite_efetiva: a.limite_ausencia_efetiva,
        });

        return {
          id: a.id,
          usuarioNome: colab?.nome || 'Desconhecido',
          dataInicio: a.ausencia_agendada_inicio || '—',
          dataTermino: a.ausencia_agendada_fim || '—',
          diasAusencia: a.dias_solicitados || 0,
          periodoAquisitivo: `${formatarData(a.inicio_periodo_aquisitivo)} - ${formatarData(a.fim_periodo_aquisitivo)}`,
          status: calc.status,
          statusLabel: calc.label,
          statusCor: calc.cor,
          statusNota: calc.nota,
          isRemarcacao: !!a.remarcacao_inicio_proposto,
          remarcacaoInicio: a.remarcacao_inicio_proposto,
          remarcacaoFim: a.remarcacao_fim_proposto,
          justificativaRemarcacao: a.justificativa_remarcacao,
        };
      });

      setSolicitacoes(mapped);
    } catch (err) {
      console.error('Erro ao carregar aprovações:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) fetchSolicitacoes();
  }, [user]);

  const filtradas = filtroStatus === 'todos'
    ? solicitacoes
    : solicitacoes.filter((s) => s.status === filtroStatus || (filtroStatus === 'pendente' && s.status === 'atrasada'));

  const handleStatusUpdate = async (s, novoStatus) => {
    setUpdatingId(s.id);
    try {
      let updatePayload;
      if (s.isRemarcacao) {
        if (novoStatus === 'aprovada') {
          // Aplica as novas datas propostas e limpa os campos de remarcação.
          updatePayload = {
            ausencia_agendada_inicio: s.remarcacaoInicio,
            ausencia_agendada_fim: s.remarcacaoFim,
            remarcacao_inicio_proposto: null,
            remarcacao_fim_proposto: null,
            justificativa_remarcacao: null,
            status_atual: 'Ausência Marcada',
          };
        } else {
          // Reprovar remarcação: descarta a proposta e mantém as datas originais já aprovadas.
          updatePayload = {
            remarcacao_inicio_proposto: null,
            remarcacao_fim_proposto: null,
            justificativa_remarcacao: null,
            status_atual: 'Ausência Marcada',
          };
        }
      } else {
        updatePayload = { status_atual: novoStatus === 'aprovada' ? 'Ausência Marcada' : 'Marcação Pendente' };
      }

      const { error } = await supabase
        .from('ciclos_ausencia')
        .update(updatePayload)
        .eq('id', s.id);

      if (error) throw error;
      await fetchSolicitacoes();
      window.dispatchEvent(new Event('aprovacoes_atualizadas'));
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="gestor-page animate-fade-in-up">
      <h1 className="page-title">
        <ClipboardCheck size={28} /> Aprovações
      </h1>
      <p className="page-subtitle">Gerencie as solicitações de ausência da sua equipe.</p>

      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-xl)', flexWrap: 'wrap', alignItems: 'center' }}>
        <Filter size={16} color="var(--color-text-muted)" />
        {['todos', 'pendente', 'aprovada', 'reprovada'].map((f) => (
          <button
            key={f}
            className={`filter-chip ${filtroStatus === f ? 'active' : ''}`}
            onClick={() => setSearchParams(f === 'pendente' ? {} : { status: f })}
          >
            {f === 'todos' ? 'Todas' : f.charAt(0).toUpperCase() + f.slice(1) + 's'}
          </button>
        ))}
      </div>

      <div className="approval-list">
        {loading ? (
          <div className="table-empty" style={{ background: 'var(--color-bg-white)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3xl)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-sm)' }}>
            <Loader2 size={18} className="animate-spin" /> Carregando solicitações…
          </div>
        ) : (
        <>
        {filtradas.map((s, i) => (
          <div
            key={s.id}
            className="approval-card"
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <div className="approval-card-avatar">
              {s.usuarioNome.split(' ').map((n) => n[0]).slice(0, 2).join('')}
            </div>
            <div className="approval-card-info">
              <div className="approval-card-name">
                {s.usuarioNome}
                {s.isRemarcacao && <span className="remarcacao-tag"><RefreshCw size={11} /> Remarcação</span>}
              </div>
              <div className="approval-card-meta">
                <div className="approval-card-meta-item">
                  <span className="label">Período Aquisitivo</span>
                  <span className="value">{s.periodoAquisitivo}</span>
                </div>
                <div className="approval-card-meta-item">
                  <span className="label">Início</span>
                  <span className="value">{formatarData(s.dataInicio)}</span>
                </div>
                <div className="approval-card-meta-item">
                  <span className="label">Término</span>
                  <span className="value">{formatarData(s.dataTermino)}</span>
                </div>
                <div className="approval-card-meta-item">
                  <span className="label">Dias</span>
                  <span className="value">{s.diasAusencia}</span>
                </div>
              </div>
              {s.isRemarcacao && (
                <div className="remarcacao-box">
                  <div className="remarcacao-dates">
                    <span className="de">{formatarData(s.dataInicio)} – {formatarData(s.dataTermino)}</span>
                    <ArrowRight size={14} />
                    <span className="para">{formatarData(s.remarcacaoInicio)} – {formatarData(s.remarcacaoFim)}</span>
                  </div>
                  {s.justificativaRemarcacao && (
                    <div className="remarcacao-justificativa">“{s.justificativaRemarcacao}”</div>
                  )}
                </div>
              )}
              {s.statusNota && (
                <div className="status-note" style={{ color: s.statusCor, backgroundColor: s.statusCor + '15', marginTop: '10px', fontSize: '12px' }}>
                  {s.status === 'atrasada' ? <AlertCircle size={14} /> : <Clock size={14} />}
                  {s.statusNota}
                </div>
              )}
            </div>
            <span className="badge" style={{ backgroundColor: s.statusCor, color: '#fff' }}>
              {s.statusLabel}
            </span>
            <div className="approval-card-actions">
              {(s.status === 'pendente' || s.status === 'atrasada') && (
                <>
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => handleStatusUpdate(s, 'aprovada')}
                    disabled={updatingId === s.id}
                  >
                    {updatingId === s.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Aprovar
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleStatusUpdate(s, 'rejeitada')}
                    disabled={updatingId === s.id}
                  >
                    {updatingId === s.id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />} Reprovar
                  </button>
                </>
              )}
              <button className="btn btn-outline btn-sm" onClick={() => navigate(`/gestor/aprovacoes/${s.id}`)}>
                <Eye size={14} /> Detalhes
              </button>
            </div>
          </div>
        ))}
        {filtradas.length === 0 && (
          <div className="table-empty" style={{ background: 'var(--color-bg-white)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3xl)' }}>
            Nenhuma solicitação encontrada.
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}
