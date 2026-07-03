import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import { formatarData, getStatusCalculado, gerarCiclosTeoricos } from '../../utils/formatters';
import { CalendarDays, Plus, CalendarCheck, Clock, CheckCircle, X, AlertTriangle, AlertCircle, History, Lock, RefreshCw } from 'lucide-react';
import '../../components/UI/Components.css';
import './Usuario.css';

const IconStatus = ({ icon, color }) => {
  const props = { size: 16, color: color, style: { marginRight: '4px' } };
  if (icon === 'CheckCircle') return <CheckCircle {...props} />;
  if (icon === 'AlertTriangle') return <AlertTriangle {...props} />;
  if (icon === 'AlertCircle') return <AlertCircle {...props} />;
  if (icon === 'Clock') return <Clock {...props} />;
  if (icon === 'History') return <History {...props} />;
  if (icon === 'Lock') return <Lock {...props} />;
  return null;
};

export default function UsuarioDashboard() {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState(0);
  const [dataInicio, setDataInicio] = useState('');
  const [diasAusencia, setDiasAusencia] = useState(21);
  const [sucesso, setSucesso] = useState(false);
  const [minhasAusencias, setMinhasAusencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cicloSelecionadoId, setCicloSelecionadoId] = useState('');
  // Remarcação de férias já aprovada
  const [showRemarcarModal, setShowRemarcarModal] = useState(false);
  const [remarcarParcela, setRemarcarParcela] = useState(null);
  const [remarcarNovaData, setRemarcarNovaData] = useState('');
  const [remarcarJustificativa, setRemarcarJustificativa] = useState('');
  const [remarcarSubmitting, setRemarcarSubmitting] = useState(false);

  useEffect(() => {
    const fetchDados = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('ciclos_ausencia')
          .select('*')
          .eq('colaborador_id', user.id);

        if (error) throw error;
        
        let existingData = data || [];

        // --- Lógica de Sincronização Automática (Inteligência Proativa) ---
        if (user?.dataAdmissao) {
          // Garantimos o ciclo atual e o próximo ciclo futuro (anosFuturos=2 para cobrir o atual + 1 proativo)
          const ciclosTeoricos = gerarCiclosTeoricos(user.dataAdmissao, 2);
          
          // Filtramos apenas os ciclos que interessam: o atual e o próximo
          // O atual é aquele onde hoje < fim_pa
          const hojeStr = new Date().toISOString().split('T')[0];
          const ciclosParaSincronizar = ciclosTeoricos.filter(c => c.fim_pa >= hojeStr).slice(0, 2);

          for (const teorico of ciclosParaSincronizar) {
            const existe = existingData.find(e => e.inicio_periodo_aquisitivo === teorico.inicio_pa);
            if (!existe) {
              const { data: inserted, error: insError } = await supabase
                .from('ciclos_ausencia')
                .upsert([{
                  colaborador_id: user.id,
                  inicio_periodo_aquisitivo: teorico.inicio_pa,
                  fim_periodo_aquisitivo: teorico.fim_pa,
                  limite_ausencia_efetiva: teorico.limite_efetiva,
                  status_atual: 'Sem direito ainda',
                  dias_solicitados: 21
                }], { onConflict: 'colaborador_id,inicio_periodo_aquisitivo' })
                .select();
              
              if (!insError && inserted) {
                existingData = [...existingData, ...inserted];
              }
            }
          }
        }
        // --- Fim da Sincronização ---

        // Debug logs
        console.log("Dados carregados do Supabase:", existingData);
        
        // Mapeia os dados do banco para o padrão esperado pelas funções de formatação
        const dadosFormatados = existingData.map(a => ({
          ...a,
          status_original: a.status_atual,
          inicio_pa: a.inicio_periodo_aquisitivo,
          fim_pa: a.fim_periodo_aquisitivo,
          limite_efetiva: a.limite_ausencia_efetiva,
          inicio_ausencia: a.ausencia_agendada_inicio,
          fim_ausencia: a.ausencia_agendada_fim,
          dias_pendentes: a.dias_solicitados
        }));

        // --- Lógica de Agrupamento por P.A. ---
        const mapaGrupos = {};
        dadosFormatados.forEach(a => {
          const chave = a.inicio_pa;
          if (!mapaGrupos[chave]) {
            mapaGrupos[chave] = {
              inicio_pa: a.inicio_pa,
              fim_pa: a.fim_pa,
              limite_efetiva: a.limite_efetiva,
              parcelas: [],
              direito: null,
              agendado: 0,
              saldo: 21,
              linhaBase: null
            };
          }

          // Direito real do período (planilha); usa o maior valor encontrado nas linhas.
          if (a.dias_direito != null && a.dias_direito !== '') {
            const d = Number(a.dias_direito);
            if (!Number.isNaN(d) && (mapaGrupos[chave].direito == null || d > mapaGrupos[chave].direito)) {
              mapaGrupos[chave].direito = d;
            }
          }

          if (a.inicio_ausencia) {
            mapaGrupos[chave].parcelas.push(a);
            mapaGrupos[chave].agendado += a.dias_solicitados || 0;
          } else {
            mapaGrupos[chave].linhaBase = a;
          }
        });

        // Saldo de cada período = direito real (planilha) ou 21 padrão, menos o que já foi agendado.
        Object.values(mapaGrupos).forEach(g => {
          g.saldo = (g.direito != null ? g.direito : 21) - g.agendado;
        });

        const listaAgrupada = Object.values(mapaGrupos).sort((a,b) => 
          new Date(a.inicio_pa).getTime() - new Date(b.inicio_pa).getTime()
        );

        console.log("Dados agrupados para exibição:", listaAgrupada);
        setMinhasAusencias(listaAgrupada);
      } catch (err) {
        console.error("Erro ao carregar ausências:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDados();
  }, [user]);

  const calcTermino = () => {
    if (!dataInicio) return '';
    const d = new Date(dataInicio + 'T00:00:00');
    d.setDate(d.getDate() + diasAusencia - 1);
    return d.toISOString().split('T')[0];
  };

  const handleFinalizar = async () => {
    try {
      if (!cicloSelecionadoId) throw new Error("Ciclo não selecionado");
      
      const grupo = minhasAusencias.find(g => (g.linhaBase?.id || g.parcelas[0]?.id) === cicloSelecionadoId);
      const isNovaParcela = grupo && grupo.parcelas.length > 0 && grupo.linhaBase?.id !== cicloSelecionadoId;

      if (isNovaParcela || !cicloSelecionadoId) {
        // Criar nova linha para a parcela
        const { error } = await supabase
          .from('ciclos_ausencia')
          .insert([{
            colaborador_id: user.id,
            inicio_periodo_aquisitivo: grupo.inicio_pa,
            fim_periodo_aquisitivo: grupo.fim_pa,
            limite_ausencia_efetiva: grupo.limite_efetiva,
            ausencia_agendada_inicio: dataInicio,
            ausencia_agendada_fim: calcTermino(),
            dias_solicitados: diasAusencia,
            status_atual: 'Marcação Pendente'
          }]);
        if (error) throw error;
      } else {
        // Atualizar linha base existente
        const { error } = await supabase
          .from('ciclos_ausencia')
          .update({
            ausencia_agendada_inicio: dataInicio,
            ausencia_agendada_fim: calcTermino(),
            dias_solicitados: diasAusencia,
            status_atual: 'Marcação Pendente'
          })
          .eq('id', cicloSelecionadoId);
        if (error) throw error;
      }

      setSucesso(true);
      setShowModal(false);
      setStep(0);
      setDataInicio('');
      setDiasAusencia(21);
      setCicloSelecionadoId('');
      
      // Recarrega os dados
      window.location.reload(); 
    } catch (err) {
      console.error("Erro ao enviar solicitação:", err);
      alert("Erro ao enviar solicitação. Tente novamente.");
    }
  };

  const resetModal = () => {
    setShowModal(false);
    setStep(0);
    setDataInicio('');
    setDiasAusencia(21);
    setCicloSelecionadoId('');
  };

  const calcFimRemarcar = () => {
    if (!remarcarNovaData || !remarcarParcela) return '';
    const d = new Date(remarcarNovaData + 'T00:00:00');
    d.setDate(d.getDate() + (remarcarParcela.dias_solicitados || 1) - 1);
    return d.toISOString().split('T')[0];
  };

  const handleAbrirRemarcar = (parcela) => {
    setRemarcarParcela(parcela);
    setRemarcarNovaData('');
    setRemarcarJustificativa('');
    setShowRemarcarModal(true);
  };

  const handleSubmitRemarcar = async () => {
    if (!remarcarParcela || !remarcarNovaData || !remarcarJustificativa.trim()) return;
    setRemarcarSubmitting(true);
    try {
      const { error } = await supabase
        .from('ciclos_ausencia')
        .update({
          remarcacao_inicio_proposto: remarcarNovaData,
          remarcacao_fim_proposto: calcFimRemarcar(),
          justificativa_remarcacao: remarcarJustificativa.trim(),
          status_atual: 'Marcação Pendente',
        })
        .eq('id', remarcarParcela.id);
      if (error) throw error;
      setShowRemarcarModal(false);
      setRemarcarParcela(null);
      setRemarcarNovaData('');
      setRemarcarJustificativa('');
      window.location.reload();
    } catch (err) {
      console.error('Erro ao remarcar:', err);
      alert('Erro ao solicitar remarcação. Tente novamente.');
    } finally {
      setRemarcarSubmitting(false);
    }
  };

  const selectedGrupo = minhasAusencias.find(g => (g.linhaBase?.id || g.parcelas[0]?.id) === cicloSelecionadoId);

  if (loading) {
    return <div className="usuario-page animate-fade-in-up">Carregando painel...</div>;
  }

  const estatisticas = minhasAusencias.reduce((acc, g) => {
    g.parcelas.forEach(p => {
      const calc = getStatusCalculado(p);
      acc[calc.status] = (acc[calc.status] || 0) + 1;
    });
    if (g.linhaBase) {
      const calc = getStatusCalculado(g.linhaBase);
      acc[calc.status] = (acc[calc.status] || 0) + 1;
    }
    return acc;
  }, {});

  return (
    <div className="usuario-page animate-fade-in-up">
      {/* Welcome card */}
      <div className="user-welcome-card">
        <div className="user-welcome-info">
          <h2>Minha Ausência</h2>
          <p>Solicite e acompanhe seus períodos de ausência.</p>
        </div>
        {minhasAusencias.some(a => {
          const s = getStatusCalculado(a).status;
          return s === 'pendente' || s === 'atrasada' || s === 'aviso';
        }) && (
          <button className="btn" onClick={() => {
            // Tenta pré-selecionar o primeiro disponível
            const first = minhasAusencias.find(a => {
              const s = getStatusCalculado(a).status;
              return s === 'pendente' || s === 'atrasada' || s === 'aviso';
            });
            if (first) setCicloSelecionadoId(first.id);
            setShowModal(true);
          }}>
            <Plus size={18} /> Solicitar Ausência
          </button>
        )}
      </div>

      {sucesso && (
        <div className="success-msg">
          <CheckCircle size={18} />
          Solicitação enviada com sucesso! Aguarde a aprovação do seu gestor.
        </div>
      )}

      {/* Info cards */}
      <div className="cards-grid" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="stat-card success">
          <div className="stat-card-header">
            <div className="stat-card-icon"><CalendarCheck size={22} /></div>
          </div>
          <div className="stat-card-value">{estatisticas.aprovada || 0}</div>
          <div className="stat-card-label">Ausências Marcadas</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-card-header">
            <div className="stat-card-icon"><Clock size={22} /></div>
          </div>
          <div className="stat-card-value">{(estatisticas.pendente || 0) + (estatisticas.atrasada || 0)}</div>
          <div className="stat-card-label">Pendentes / Atrasadas</div>
        </div>
        <div className="stat-card primary">
          <div className="stat-card-header">
            <div className="stat-card-icon"><History size={22} /></div>
          </div>
          <div className="stat-card-value">{estatisticas.concluida || 0}</div>
          <div className="stat-card-label">Histórico (OK)</div>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <div className="table-header-title">Meus Períodos e Saldos</div>
        </div>
        
        {minhasAusencias.length === 0 ? (
          <div className="table-empty">Você ainda não possui períodos de ausência registrados.</div>
        ) : (
          <div className="pa-groups-list">
            {minhasAusencias
              .filter(g => {
                const fimPA = new Date(g.fim_pa + 'T00:00:00');
                const agora = new Date();
                const limiteFuturo = new Date(agora);
                limiteFuturo.setFullYear(limiteFuturo.getFullYear() + 1);
                limiteFuturo.setMonth(11);
                limiteFuturo.setDate(31);
                return fimPA <= limiteFuturo || g.parcelas.length > 0;
              })
              .map((g, idx) => {
                return (
                  <div key={idx} className="pa-group-card">
                    <div className="pa-group-header">
                      <div className="pa-group-title">
                        <CalendarDays size={20} className="icon-main" />
                        <div>
                          <h3>{formatarData(g.inicio_pa)} - {formatarData(g.fim_pa)}</h3>
                          <span className="pa-limit">Limite para gozo: {formatarData(g.limite_efetiva)}</span>
                        </div>
                      </div>
                      <div className="pa-group-balance">
                        <span className="balance-label">Saldo Disponível</span>
                        <div className={`balance-value ${g.saldo > 0 ? 'has-balance' : 'no-balance'}`}>
                          {g.saldo} <span>dias</span>
                        </div>
                      </div>
                    </div>

                    <div className="pa-group-content">
                      {g.parcelas.length > 0 ? (
                        <div className="parcelas-list">
                          {g.parcelas.map((p, pIdx) => {
                            const pCalc = getStatusCalculado(p);
                            const hojeStr = new Date().toISOString().split('T')[0];
                            const temRemarcacaoPendente = !!p.remarcacao_inicio_proposto;
                            const podeRemarcar = pCalc.status === 'aprovada' && p.inicio_ausencia && p.inicio_ausencia > hojeStr;
                            return (
                              <div key={pIdx} className="parcela-row">
                                <div className="parcela-item">
                                  <div className="parcela-info">
                                    <span className="parcela-dates">{formatarData(p.inicio_ausencia)} - {formatarData(p.fim_ausencia)}</span>
                                    <span className="parcela-days">{p.dias_solicitados} dias</span>
                                  </div>
                                  <div className="parcela-status" style={{ color: pCalc.cor }}>
                                    <IconStatus icon={pCalc.icon} color={pCalc.cor} />
                                    {pCalc.label}
                                  </div>
                                </div>
                                {temRemarcacaoPendente ? (
                                  <div className="parcela-remarcacao-note">
                                    <RefreshCw size={13} />
                                    <span>
                                      Remarcação solicitada para <strong>{formatarData(p.remarcacao_inicio_proposto)} – {formatarData(p.remarcacao_fim_proposto)}</strong> · aguardando aprovação do gestor
                                    </span>
                                  </div>
                                ) : podeRemarcar ? (
                                  <div className="parcela-remarcar-row">
                                    <button className="btn btn-sm btn-outline-primary" onClick={() => handleAbrirRemarcar(p)}>
                                      <RefreshCw size={13} /> Remarcar
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="parcelas-empty">Nenhuma parcela marcada para este período.</div>
                      )}

                      {g.saldo > 0 && (
                        <div className="pa-group-footer">
                          <button 
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => {
                              setCicloSelecionadoId(g.linhaBase?.id || g.parcelas[0]?.id);
                              setDiasAusencia(g.saldo);
                              setShowModal(true);
                              setStep(1); // Pula a escolha do período já que clicou no grupo
                            }}
                          >
                            <Plus size={14} /> Marcar Parcela
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Modal Wizard */}
      {showModal && (
        <div className="modal-overlay" onClick={resetModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Solicitar Ausência</span>
              <button className="modal-close" onClick={resetModal}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {/* Wizard steps indicator */}
              <div className="wizard-steps">
                {[0, 1, 2, 3].map((s) => (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className={`wizard-step ${step === s ? 'active' : step > s ? 'done' : ''}`}>
                      <div className="wizard-step-number">{step > s ? '✓' : s === 0 ? 'P' : s}</div>
                      <span>{s === 0 ? 'Período' : s === 1 ? 'Data' : s === 2 ? 'Dias' : 'Resumo'}</span>
                    </div>
                    {s < 3 && <div className={`wizard-step-line ${step > s ? 'done' : ''}`} />}
                  </div>
                ))}
              </div>

              {/* Step 0: Escolher Período */}
              {step === 0 && (
                <div className="animate-fade-in-up">
                  <p style={{ marginBottom: 'var(--space-lg)', color: 'var(--color-text-secondary)' }}>
                    Selecione para qual período aquisitivo deseja solicitar:
                  </p>
                  <div className="form-group">
                    <label className="form-label">Período <span className="required">*</span></label>
                    <select 
                      className="form-input" 
                      value={cicloSelecionadoId}
                      onChange={(e) => setCicloSelecionadoId(e.target.value)}
                    >
                      <option value="">Selecione um período...</option>
                      {minhasAusencias
                        .filter(g => g.saldo > 0)
                        .map(g => (
                          <option key={g.linhaBase?.id || g.parcelas[0]?.id} value={g.linhaBase?.id || g.parcelas[0]?.id}>
                            {formatarData(g.inicio_pa)} - {formatarData(g.fim_pa)} (Saldo: {g.saldo} dias)
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Step 1: Data */}
              {step === 1 && (
                <div className="animate-fade-in-up">
                  <p style={{ marginBottom: 'var(--space-lg)', color: 'var(--color-text-secondary)' }}>
                    Selecione a data de início da sua ausência:
                  </p>
                  <div className="form-group">
                    <label className="form-label">Data de Início <span className="required">*</span></label>
                    <input
                      type="date"
                      className="form-input"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Dias */}
              {step === 2 && (
                <div className="animate-fade-in-up">
                  <p style={{ marginBottom: 'var(--space-lg)', color: 'var(--color-text-secondary)' }}>
                    Quantos dias de ausência deseja solicitar?
                  </p>
                  <div className="form-group">
                    <label className="form-label">Quantidade de Dias <span className="required">*</span></label>
                    <input
                      type="number"
                      className="form-input"
                      value={diasAusencia}
                      onChange={(e) => setDiasAusencia(Number(e.target.value))}
                      min={1}
                      max={selectedGrupo ? selectedGrupo.saldo : 21}
                    />
                  </div>
                </div>
              )}

              {/* Step 3: Resumo */}
              {step === 3 && (
                <div className="animate-fade-in-up">
                  <p style={{ marginBottom: 'var(--space-lg)', color: 'var(--color-text-secondary)' }}>
                    Confira os dados da sua solicitação:
                  </p>
                  <div className="summary-card">
                    <div className="summary-row">
                      <span className="label">Data de Início</span>
                      <span className="value">{formatarData(dataInicio)}</span>
                    </div>
                    <div className="summary-row">
                      <span className="label">Quantidade de Dias</span>
                      <span className="value">{diasAusencia} dias</span>
                    </div>
                    <div className="summary-row">
                      <span className="label">Data de Término</span>
                      <span className="value">{formatarData(calcTermino())}</span>
                    </div>
                      {selectedGrupo && (
                        <div className="summary-row">
                          <span className="label">Período Aquisitivo</span>
                          <span className="value">{formatarData(selectedGrupo.inicio_pa)} - {formatarData(selectedGrupo.fim_pa)}</span>
                        </div>
                      )}
                      <div className="summary-row">
                        <span className="label">Status Inicial</span>
                        <span className="badge pendente">Marcação Pendente</span>
                      </div>
                    </div>
                  </div>
                )}
            </div>

            <div className="modal-footer">
              {step > 1 && (
                <button className="btn btn-outline" onClick={() => setStep(step - 1)}>
                  Voltar
                </button>
              )}
              {step < 3 ? (
                <button
                  className="btn btn-primary"
                  onClick={() => setStep(step + 1)}
                  disabled={(step === 0 && !cicloSelecionadoId) || (step === 1 && !dataInicio)}
                >
                  Próximo
                </button>
              ) : (
                <button className="btn btn-success" onClick={handleFinalizar}>
                  <CheckCircle size={16} /> Finalizar Solicitação
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Remarcar */}
      {showRemarcarModal && remarcarParcela && (
        <div className="modal-overlay" onClick={() => setShowRemarcarModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Remarcar Ausência</span>
              <button className="modal-close" onClick={() => setShowRemarcarModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="summary-card" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="summary-row">
                  <span className="label">Período atual</span>
                  <span className="value">{formatarData(remarcarParcela.inicio_ausencia)} - {formatarData(remarcarParcela.fim_ausencia)}</span>
                </div>
                <div className="summary-row">
                  <span className="label">Quantidade de dias</span>
                  <span className="value">{remarcarParcela.dias_solicitados} dias</span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Nova data de início <span className="required">*</span></label>
                <input
                  type="date"
                  className="form-input"
                  value={remarcarNovaData}
                  onChange={(e) => setRemarcarNovaData(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              {remarcarNovaData && (
                <div className="summary-card" style={{ marginBottom: 'var(--space-lg)' }}>
                  <div className="summary-row">
                    <span className="label">Novo término</span>
                    <span className="value">{formatarData(calcFimRemarcar())}</span>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Justificativa <span className="required">*</span></label>
                <textarea
                  className="form-input"
                  rows={3}
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  placeholder="Explique o motivo da remarcação..."
                  value={remarcarJustificativa}
                  onChange={(e) => setRemarcarJustificativa(e.target.value)}
                />
              </div>

              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                A remarcação volta para aprovação do seu gestor. As datas atuais ficam mantidas até a aprovação.
              </p>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowRemarcarModal(false)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSubmitRemarcar}
                disabled={!remarcarNovaData || !remarcarJustificativa.trim() || remarcarSubmitting}
              >
                {remarcarSubmitting ? 'Enviando...' : <><RefreshCw size={16} /> Solicitar Remarcação</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
