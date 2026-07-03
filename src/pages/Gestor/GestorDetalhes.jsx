import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { formatarData } from '../../utils/formatters';
import { ArrowLeft, FileText, Check, X } from 'lucide-react';
import '../../components/UI/Components.css';
import './Gestor.css';

export default function GestorDetalhes() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sol, setSol] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const handleStatusUpdate = async (novoStatus) => {
    setUpdating(true);
    try {
      let updatePayload;
      if (sol?.isRemarcacao) {
        if (novoStatus === 'aprovada') {
          updatePayload = {
            ausencia_agendada_inicio: sol.remarcacaoInicio,
            ausencia_agendada_fim: sol.remarcacaoFim,
            remarcacao_inicio_proposto: null,
            remarcacao_fim_proposto: null,
            justificativa_remarcacao: null,
            status_atual: 'Ausência Marcada',
          };
        } else {
          // Reprovar remarcação: mantém as datas originais já aprovadas.
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
        .eq('id', id);

      if (error) throw error;

      navigate(-1);
    } catch (err) {
      console.error("Erro ao atualizar status:", err);
      alert("Erro ao processar solicitação. Tente novamente.");
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    const fetchSol = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('ciclos_ausencia')
        .select(`
          *,
          colaboradores (
            nome,
            funcao,
            data_admissao,
            superior:superior_id (nome)
          )
        `)
        .eq('id', id)
        .single();
        
      if (!error && data) {
        setSol({
          id: data.id,
          usuarioName: data.colaboradores?.nome || 'Desconhecido',
          usuarioNome: data.colaboradores?.nome || 'Desconhecido',
          funcao: data.colaboradores?.funcao || '—',
          superior: data.colaboradores?.superior?.nome || '—',
          dataAdmissao: data.colaboradores?.data_admissao,
          dataInicio: data.ausencia_agendada_inicio,
          dataTermino: data.ausencia_agendada_fim,
          diasAusencia: data.dias_solicitados || 0,
          periodoAquisitivo: data.inicio_periodo_aquisitivo ? `${formatarData(data.inicio_periodo_aquisitivo)} - ${formatarData(data.fim_periodo_aquisitivo)}` : '—',
          limite: data.limite_ausencia_efetiva ? formatarData(data.limite_ausencia_efetiva) : '—',
          status: data.status_atual === 'Ausência Marcada' ? 'aprovada' : data.status_atual === 'Marcação Pendente' ? 'pendente' : 'rejeitada',
          isRemarcacao: !!data.remarcacao_inicio_proposto,
          remarcacaoInicio: data.remarcacao_inicio_proposto,
          remarcacaoFim: data.remarcacao_fim_proposto,
          justificativaRemarcacao: data.justificativa_remarcacao,
        });
      }
      setLoading(false);
    };
    if (id) fetchSol();
  }, [id]);

  if (loading) return <div className="gestor-page animate-fade-in-up">Carregando...</div>;

  if (!sol) {
    return (
      <div className="gestor-page animate-fade-in-up">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="table-empty" style={{ background: 'var(--color-bg-white)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3xl)' }}>
          Solicitação não encontrada.
        </div>
      </div>
    );
  }

  return (
    <div className="gestor-page animate-fade-in-up">
      <button className="back-btn" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Voltar às aprovações
      </button>
      <h1 className="page-title">
        <FileText size={28} /> Detalhes da Solicitação
      </h1>

      <div className="form-card">
        <div className="form-card-header">
          <div className="approval-card-avatar" style={{ width: 40, height: 40, fontSize: 'var(--font-size-sm)' }}>
            {sol.usuarioNome.split(' ').map((n) => n[0]).slice(0, 2).join('')}
          </div>
          <h2>{sol.usuarioNome}</h2>
          <span className={`badge ${sol.status}`} style={{ marginLeft: 'auto' }}>{sol.status}</span>
        </div>
        <div className="form-card-body">
          <div className="detail-grid">
            <div className="detail-item">
              <span className="label">Colaborador</span>
              <span className="value">{sol.usuarioNome}</span>
            </div>

            <div className="detail-item">
              <span className="label">Função</span>
              <span className="value">{sol.funcao}</span>
            </div>
            <div className="detail-item">
              <span className="label">Superior</span>
              <span className="value">{sol.superior}</span>
            </div>
            <div className="detail-item">
              <span className="label">Data de Admissão</span>
              <span className="value">{formatarData(sol.dataAdmissao)}</span>
            </div>
            <div className="detail-item">
              <span className="label">Período Aquisitivo</span>
              <span className="value">{sol.periodoAquisitivo}</span>
            </div>
            <div className="detail-item">
              <span className="label">Início da Ausência</span>
              <span className="value" style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
                {formatarData(sol.dataInicio)}
              </span>
            </div>
            <div className="detail-item">
              <span className="label">Término da Ausência</span>
              <span className="value" style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
                {formatarData(sol.dataTermino)}
              </span>
            </div>
            <div className="detail-item">
              <span className="label">Dias Solicitados</span>
              <span className="value">{sol.diasAusencia} dias</span>
            </div>
            <div className="detail-item">
              <span className="label">Data da Solicitação</span>
              <span className="value">{formatarData(sol.dataSolicitacao)}</span>
            </div>
            <div className="detail-item">
              <span className="label">Status</span>
              <span className={`badge ${sol.status}`}>{sol.status}</span>
            </div>
            {sol.observacoes && (
              <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                <span className="label">Observações</span>
                <span className="value" style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>
                  {sol.observacoes}
                </span>
              </div>
            )}
            {sol.isRemarcacao && (
              <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                <span className="label">Remarcação solicitada</span>
                <span className="value">
                  {formatarData(sol.dataInicio)} – {formatarData(sol.dataTermino)} → <strong style={{ color: '#9b59b6' }}>{formatarData(sol.remarcacaoInicio)} – {formatarData(sol.remarcacaoFim)}</strong>
                </span>
                {sol.justificativaRemarcacao && (
                  <span className="value" style={{ fontWeight: 400, color: 'var(--color-text-secondary)', fontStyle: 'italic', marginTop: '4px' }}>
                    “{sol.justificativaRemarcacao}”
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        {sol.status === 'pendente' && (
          <div className="form-card-footer">
            <button 
              className="btn btn-danger" 
              onClick={() => handleStatusUpdate('rejeitada')}
              disabled={updating}
            >
              <X size={16} /> {updating ? 'Processando...' : 'Reprovar'}
            </button>
            <button 
              className="btn btn-success" 
              onClick={() => handleStatusUpdate('aprovada')}
              disabled={updating}
            >
              <Check size={16} /> {updating ? 'Processando...' : 'Aprovar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
