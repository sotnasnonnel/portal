import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import { getEquipeIds } from '../../services/equipe';
import { getStatusCalculado, formatarData } from '../../utils/formatters';
import { Users, ClipboardCheck, CalendarClock, TrendingUp, AlertCircle, ClipboardList, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { acaoDisponivel, resumoAndamento, TIPO_LABEL } from '../../config/aprovacao';
import '../../components/UI/Components.css';
import './Gestor.css';

// Mapeia o tom do andamento da requisição para rótulo + classe de badge (igual ao Acompanhar).
const TOM_BADGE = {
  pendente: { label: 'Em andamento', badge: 'pendente' },
  concluida: { label: 'Concluída', badge: 'aprovada' },
  reprovada: { label: 'Reprovada', badge: 'inativo' },
};

export default function GestorDashboard() {
  const [equipe, setEquipe] = useState([]);
  const [minhasSolicitacoes, setMinhasSolicitacoes] = useState([]);
  const [requisicoes, setRequisicoes] = useState([]);
  const [nomesReq, setNomesReq] = useState({}); // gestor_id -> nome do solicitante (via RPC)
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const idsEquipe = await getEquipeIds();
        const { data: cols, error: colsError } = idsEquipe.length
          ? await supabase.from('colaboradores').select('*').in('id', idsEquipe).order('nome')
          : { data: [], error: null };

        if (colsError) throw colsError;
        setEquipe(cols || []);

        if (cols && cols.length > 0) {
          const ids = cols.map((c) => c.id);

          const { data: cics, error: cicsError } = await supabase
            .from('ciclos_ausencia')
            .select('*')
            .in('colaborador_id', ids);

          if (cicsError) throw cicsError;

          const mapped = cics.map((c) => {
            const colab = cols.find((col) => col.id === c.colaborador_id);
            return {
              ...c,
              colaborador_nome: colab?.nome || 'Desconhecido',
              status_original: c.status_atual,
              inicio_pa: c.inicio_periodo_aquisitivo,
              fim_pa: c.fim_periodo_aquisitivo,
              limite_efetiva: c.limite_ausencia_efetiva,
              inicio_ausencia: c.ausencia_agendada_inicio,
              fim_ausencia: c.ausencia_agendada_fim,
            };
          });

          setMinhasSolicitacoes(mapped);
        } else {
          setMinhasSolicitacoes([]);
        }

        // Requisições DP: a RLS já devolve só as que o gestor criou ou aprova.
        const { data: reqs } = await supabase
          .from('solicitacoes_rh')
          .select(`
            id, tipo, status, gestor_id, created_at,
            colaborador:colaborador_id ( nome ),
            etapas:solicitacoes_rh_etapas ( id, ordem, aprovador_id, tipo_etapa, status )
          `)
          .order('created_at', { ascending: false });
        setRequisicoes(reqs || []);

        // Nome do solicitante via RPC (a RLS de colaboradores esconde quem não é
        // superior; a RPC SECURITY DEFINER devolve só id+nome).
        const gids = [...new Set((reqs || []).map((r) => r.gestor_id).filter(Boolean))];
        if (gids.length) {
          const { data: nm } = await supabase.rpc('nomes_colaboradores', { p_ids: gids });
          setNomesReq(Object.fromEntries((nm || []).map((c) => [c.id, c.nome])));
        }
      } catch (err) {
        console.error('Erro ao carregar Dashboard do Gestor:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  const statusInfo = minhasSolicitacoes.map((a) => ({
    ...a,
    calc: getStatusCalculado(a),
  }));

  const pendentes = statusInfo.filter((s) => s.calc.status === 'pendente' || s.calc.status === 'atrasada');
  const aprovadas = statusInfo.filter((s) => s.calc.status === 'aprovada');

  // Requisições DP: paradas em mim agora vs. as que eu criei e ainda estão em andamento.
  const reqAAprovar = requisicoes.filter((s) => acaoDisponivel(user?.id, s.etapas) === 'aprovacao');
  const reqMinhasEmAndamento = requisicoes.filter((s) => s.gestor_id === user?.id && s.status === 'pendente');
  const reqRecentes = requisicoes.slice(0, 5);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const limiteSemana = new Date(hoje);
  limiteSemana.setDate(limiteSemana.getDate() + 7);

  const proximasAusencias = statusInfo
    .filter((s) => {
      if (!s.inicio_ausencia) return false;
      const inicio = new Date(s.inicio_ausencia + 'T00:00:00');
      return inicio >= hoje && inicio <= limiteSemana;
    })
    .sort((a, b) => new Date(a.inicio_ausencia) - new Date(b.inicio_ausencia));

  if (loading) {
    return <div className="gestor-page animate-fade-in-up">Carregando indicadores...</div>;
  }

  return (
    <div className="gestor-page animate-fade-in-up">
      <div className="dashboard-cards">
        <div className="stat-card secondary" onClick={() => navigate('/gestor/equipe')}>
          <div className="stat-card-header">
            <div className="stat-card-icon">
              <Users size={22} />
            </div>
          </div>
          <div className="stat-card-value">{equipe.length}</div>
          <div className="stat-card-label">Meu Time</div>
        </div>

        <div className="stat-card warning" onClick={() => navigate('/gestor/aprovacoes')}>
          <div className="stat-card-header">
            <div className="stat-card-icon">
              <ClipboardCheck size={22} />
            </div>
          </div>
          <div className="stat-card-value">{pendentes.length}</div>
          <div className="stat-card-label">Ausências Pendentes de Aprovação</div>
        </div>

        <div className="stat-card success" onClick={() => navigate('/gestor/aprovacoes?status=aprovada')}>
          <div className="stat-card-header">
            <div className="stat-card-icon">
              <TrendingUp size={22} />
            </div>
          </div>
          <div className="stat-card-value">{aprovadas.length}</div>
          <div className="stat-card-label">Ausências Aprovadas</div>
        </div>

        <div className="stat-card accent" onClick={() => navigate('/gestor/ausencia')}>
          <div className="stat-card-header">
            <div className="stat-card-icon">
              <CalendarClock size={22} />
            </div>
          </div>
          <div className="stat-card-value">{minhasSolicitacoes.length}</div>
          <div className="stat-card-label">Total de Períodos</div>
        </div>

        <div className="stat-card warning" onClick={() => navigate('/gestor/solicitacoes/acompanhar')}>
          <div className="stat-card-header">
            <div className="stat-card-icon">
              <ClipboardList size={22} />
            </div>
          </div>
          <div className="stat-card-value">{reqAAprovar.length}</div>
          <div className="stat-card-label">Requisições a aprovar</div>
        </div>

        <div className="stat-card secondary" onClick={() => navigate('/gestor/solicitacoes/acompanhar')}>
          <div className="stat-card-header">
            <div className="stat-card-icon">
              <FileText size={22} />
            </div>
          </div>
          <div className="stat-card-value">{reqMinhasEmAndamento.length}</div>
          <div className="stat-card-label">Requisições em andamento</div>
        </div>
      </div>

      <div className="table-container" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="table-header">
          <div className="table-header-title">Requisições recentes</div>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/gestor/solicitacoes/acompanhar')}>
            Ver todas
          </button>
        </div>
        {reqRecentes.length === 0 ? (
          <div className="table-empty">Nenhuma requisição ainda.</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Solicitante</th>
                  <th>Andamento</th>
                </tr>
              </thead>
              <tbody>
                {reqRecentes.map((s) => {
                  const resumo = resumoAndamento(s, s.etapas);
                  const tomB = TOM_BADGE[resumo.tom] || TOM_BADGE.pendente;
                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{TIPO_LABEL[s.tipo] || s.tipo}</td>
                      <td>{nomesReq[s.gestor_id] || '—'}</td>
                      <td><span className={`badge ${tomB.badge}`}>{tomB.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="table-container" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="table-header">
          <div className="table-header-title">Ausência(s) marcada(s) para próxima semana</div>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/gestor/ausencia')}>
            Ver gestão de ausência
          </button>
        </div>
        {proximasAusencias.length === 0 ? (
          <div className="table-empty">Ninguém da equipe entra em ausência nos próximos 7 dias.</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Início</th>
                  <th>Término</th>
                  <th>Dias</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {proximasAusencias.map((s, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{s.colaborador_nome}</td>
                    <td>{formatarData(s.inicio_ausencia)}</td>
                    <td>{formatarData(s.fim_ausencia)}</td>
                    <td>{s.dias_solicitados || 0} dias</td>
                    <td>
                      <span className="badge" style={{ backgroundColor: s.calc.cor, color: '#fff', fontSize: '10px' }}>
                        {s.calc.label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pendentes.length > 0 && (
        <div className="table-container">
          <div className="table-header">
            <div className="table-header-title">Pendências Recentes</div>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/gestor/aprovacoes')}>
              Ver Todas
            </button>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Período Aquisitivo</th>
                  <th>Limite Gozo</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pendentes.slice(0, 5).map((s, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{s.colaborador_nome}</td>
                    <td>{formatarData(s.inicio_pa)} - {formatarData(s.fim_pa)}</td>
                    <td style={{ color: s.calc.status === 'atrasada' ? 'var(--color-danger)' : 'inherit' }}>
                      {formatarData(s.limite_efetiva)}
                    </td>
                    <td>
                      <span className="badge" style={{ backgroundColor: s.calc.cor, color: '#fff', fontSize: '10px' }}>
                        {s.calc.label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
