import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import { getEquipeIds } from '../../services/equipe';
import { formatarData, getStatusCalculado } from '../../utils/formatters';
import { CalendarClock, UserCheck, AlertTriangle, Clock, Timer, FileSpreadsheet, Users } from 'lucide-react';
import '../../components/UI/Components.css';
import './Gestor.css';

const getMonthStart = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const getMonthEnd = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);
const addMonths = (date, months) => new Date(date.getFullYear(), date.getMonth() + months, 1);
const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const getDaysInMonth = (date) => {
  const start = getMonthStart(date);
  const end = getMonthEnd(date);
  const days = [];
  for (let day = 1; day <= end.getDate(); day += 1) {
    days.push(new Date(start.getFullYear(), start.getMonth(), day));
  }
  return days;
};

const getCellState = (ausencia, day) => {
  const inicio = new Date(`${ausencia.inicio_ausencia}T00:00:00`);
  const fim = new Date(`${ausencia.fim_ausencia}T00:00:00`);
  return day >= inicio && day <= fim;
};

// Normaliza um ciclo (vindo da tabela ou da RPC global) para o formato usado na tela.
const mapCiclo = (c, nome) => ({
  ...c,
  colaborador_nome: nome || c.colaborador_nome || 'Desconhecido',
  status_original: c.status_atual,
  inicio_ausencia: c.ausencia_agendada_inicio,
  fim_ausencia: c.ausencia_agendada_fim,
  inicio_pa: c.inicio_periodo_aquisitivo,
  fim_pa: c.fim_periodo_aquisitivo,
  limite_efetiva: c.limite_ausencia_efetiva,
  dias_pendentes: c.dias_solicitados,
});

export default function GestorAusencia() {
  const { user } = useAuth();
  const [filtroAtivo, setFiltroAtivo] = useState('todos');
  const [todasAusenciasEquipe, setTodasAusenciasEquipe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mesReferencia, setMesReferencia] = useState(() => getMonthStart(new Date()));
  // Escopo do CALENDÁRIO: 'equipe' (só a equipe direta, padrão) ou 'todos' (empresa toda).
  const [escopoCalendario, setEscopoCalendario] = useState('equipe');
  const [ausenciasTodos, setAusenciasTodos] = useState(null); // carregado sob demanda
  const [loadingTodos, setLoadingTodos] = useState(false);

  useEffect(() => {
    const fetchDados = async () => {
      setLoading(true);
      try {
        const idsEquipe = await getEquipeIds();
        const { data: cols, error: colsError } = idsEquipe.length
          ? await supabase.from('colaboradores').select('*').in('id', idsEquipe).order('nome')
          : { data: [], error: null };

        if (colsError) throw colsError;

        if (cols && cols.length > 0) {
          const ids = cols.map((c) => c.id);
          const { data: cics, error: cicsError } = await supabase
            .from('ciclos_ausencia')
            .select('*')
            .in('colaborador_id', ids);

          if (cicsError) throw cicsError;

          const mappedCics = cics.map((c) =>
            mapCiclo(c, cols.find((col) => col.id === c.colaborador_id)?.nome)
          );

          setTodasAusenciasEquipe(mappedCics);
        } else {
          setTodasAusenciasEquipe([]);
        }
      } catch (err) {
        console.error('Erro ao carregar dados de ausencia:', err);
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) fetchDados();
  }, [user]);

  // Carrega o calendário de TODA a empresa só quando o gestor escolhe "Todas as pessoas".
  useEffect(() => {
    if (escopoCalendario !== 'todos' || ausenciasTodos !== null) return;
    let cancelled = false;
    (async () => {
      setLoadingTodos(true);
      const { data, error } = await supabase.rpc('get_calendario_ausencias_global');
      if (cancelled) return;
      if (error) {
        console.error('Erro ao carregar calendário global:', error);
        setAusenciasTodos([]);
      } else {
        setAusenciasTodos((data || []).map((c) => mapCiclo(c)));
      }
      setLoadingTodos(false);
    })();
    return () => { cancelled = true; };
  }, [escopoCalendario, ausenciasTodos]);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const emAusencia = todasAusenciasEquipe
    .filter((a) => {
      const calc = getStatusCalculado(a);
      if (calc.status !== 'aprovada' || !a.inicio_ausencia || !a.fim_ausencia) return false;
      const inicio = new Date(`${a.inicio_ausencia}T00:00:00`);
      const termino = new Date(`${a.fim_ausencia}T00:00:00`);
      return inicio <= hoje && termino >= hoje;
    })
    .map((a) => ({
      ...a,
      nome: a.colaborador_nome,
      dataInicio: a.inicio_ausencia,
      dataTermino: a.fim_ausencia,
      diasAusencia: a.dias_pendentes || 0,
    }));

  const aVencer = todasAusenciasEquipe
    .filter((a) => {
      const calc = getStatusCalculado(a);
      return calc.status === 'aviso' || calc.status === 'pendente';
    })
    .map((a) => ({ ...a, nome: a.colaborador_nome }));

  const vencidas = todasAusenciasEquipe
    .filter((a) => {
      const calc = getStatusCalculado(a);
      return calc.status === 'atrasada';
    })
    .map((a) => ({ ...a, nome: a.colaborador_nome }));

  // Cards (Em Ausência / A Vencer / Vencidas) seguem sempre a equipe do gestor.
  // O calendário abaixo respeita o filtro de escopo.
  const fonteCalendario = escopoCalendario === 'todos' ? (ausenciasTodos || []) : todasAusenciasEquipe;

  const ausenciasFuturas = fonteCalendario
    .filter((a) => {
      if (!a.inicio_ausencia || !a.fim_ausencia) return false;
      const termino = new Date(`${a.fim_ausencia}T00:00:00`);
      return termino >= hoje;
    })
    .sort((a, b) => new Date(a.inicio_ausencia) - new Date(b.inicio_ausencia));

  const calendarRows = Object.values(
    ausenciasFuturas.reduce((acc, ausencia) => {
      const key = ausencia.colaborador_id || ausencia.colaborador_nome;
      const calc = getStatusCalculado(ausencia);
      const inicio = new Date(`${ausencia.inicio_ausencia}T00:00:00`);
      const termino = new Date(`${ausencia.fim_ausencia}T00:00:00`);
      const isAbsent = inicio <= hoje && termino >= hoje;

      if (!acc[key]) {
        acc[key] = {
          key,
          nome: ausencia.colaborador_nome,
          emAusencia: false,
          ausencias: [],
        };
      }

      acc[key].ausencias.push({ ...ausencia, calc, isAbsent });
      if (isAbsent) acc[key].emAusencia = true;
      return acc;
    }, {})
  )
    .map((group) => ({
      ...group,
      ausencias: group.ausencias.sort((a, b) => new Date(a.inicio_ausencia) - new Date(b.inicio_ausencia)),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  const monthStart = getMonthStart(mesReferencia);
  const monthEnd = getMonthEnd(mesReferencia);
  const monthDays = getDaysInMonth(mesReferencia);
  const monthLabel = mesReferencia.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const calendarMonthRows = calendarRows
    .map((row) => {
      const ausenciasNoMes = row.ausencias.filter((a) => {
        const inicio = new Date(`${a.inicio_ausencia}T00:00:00`);
        const fim = new Date(`${a.fim_ausencia}T00:00:00`);
        return inicio <= monthEnd && fim >= monthStart;
      });

      return {
        ...row,
        ausenciasNoMes,
      };
    })
    .filter((row) => row.ausenciasNoMes.length > 0);

  const getListaFiltrada = () => {
    if (filtroAtivo === 'em-ausencia') return emAusencia.map((s) => ({ ...s, tipo: 'em-ausencia' }));
    if (filtroAtivo === 'a-vencer') return aVencer.map((u) => ({ ...u, tipo: 'a-vencer' }));
    if (filtroAtivo === 'vencidas') return vencidas.map((u) => ({ ...u, tipo: 'vencidas' }));
    return null;
  };

  const listaFiltrada = getListaFiltrada();

  const handleExportExcel = async () => {
    if (!listaFiltrada) return;
    const XLSX = await import('xlsx');

    let sheetName = "Ausências";
    let fileName = "Relatorio_Ausencias";
    let dataToExport = [];

    if (filtroAtivo === 'em-ausencia') {
      sheetName = "Em Ausência";
      fileName = "Colaboradores_Em_Ausencia";
      dataToExport = listaFiltrada.map(item => ({
        'Colaborador': item.nome,
        'Início': formatarData(item.dataInicio),
        'Término': formatarData(item.dataTermino),
        'Dias': item.diasAusencia
      }));
    } else if (filtroAtivo === 'a-vencer') {
      sheetName = "A Vencer";
      fileName = "Ausencias_A_Vencer";
      dataToExport = listaFiltrada.map(item => ({
        'Colaborador': item.nome,
        'Período Aquisitivo': `${formatarData(item.inicio_pa)} - ${formatarData(item.fim_pa)}`,
        'Data Limite': formatarData(item.limite_efetiva),
        'Dias Solicitados/Marcados': item.dias_pendentes || 0
      }));
    } else if (filtroAtivo === 'vencidas') {
      sheetName = "Vencidas";
      fileName = "Ausencias_Vencidas";
      dataToExport = listaFiltrada.map(item => ({
        'Colaborador': item.nome,
        'Período Aquisitivo': `${formatarData(item.inicio_pa)} - ${formatarData(item.fim_pa)}`,
        'Data Limite': formatarData(item.limite_efetiva),
        'Dias Solicitados/Marcados': item.dias_pendentes || 0
      }));
    }

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    
    XLSX.writeFile(wb, `${fileName}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
  };

  if (loading) {
    return (
      <div className="gestor-page animate-fade-in-up">
        <h1 className="page-title"><CalendarClock size={28} /> Gestão de Ausência</h1>
        <div style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}>Carregando pendências...</div>
      </div>
    );
  }

  return (
    <div className="gestor-page animate-fade-in-up">
      <h1 className="page-title">
        <CalendarClock size={28} /> Gestão de Ausência
      </h1>
      <p className="page-subtitle">Acompanhe o status das ausências da sua equipe.</p>

      <div className="absence-cards">
        <div
          className={`absence-card em-ausencia ${filtroAtivo === 'em-ausencia' ? 'active' : ''}`}
          onClick={() => setFiltroAtivo(filtroAtivo === 'em-ausencia' ? 'todos' : 'em-ausencia')}
        >
          <div className="absence-card-icon">
            <UserCheck size={28} />
          </div>
          <div className="absence-card-count">{emAusencia.length}</div>
          <div className="absence-card-label">Em Ausência</div>
        </div>

        <div
          className={`absence-card a-vencer ${filtroAtivo === 'a-vencer' ? 'active' : ''}`}
          onClick={() => setFiltroAtivo(filtroAtivo === 'a-vencer' ? 'todos' : 'a-vencer')}
        >
          <div className="absence-card-icon">
            <AlertTriangle size={28} />
          </div>
          <div className="absence-card-count">{aVencer.length}</div>
          <div className="absence-card-label">A Vencer</div>
        </div>

        <div
          className={`absence-card vencidas ${filtroAtivo === 'vencidas' ? 'active' : ''}`}
          onClick={() => setFiltroAtivo(filtroAtivo === 'vencidas' ? 'todos' : 'vencidas')}
        >
          <div className="absence-card-icon">
            <Clock size={28} />
          </div>
          <div className="absence-card-count">{vencidas.length}</div>
          <div className="absence-card-label">Vencidas</div>
        </div>
      </div>

      {listaFiltrada && (
        <div className="table-container absence-filter-container" style={{ marginBottom: 'var(--space-xl)' }}>
          <div className="table-header">
            <div className="table-header-title">
              {filtroAtivo === 'em-ausencia' && 'Colaboradores em Ausência'}
              {filtroAtivo === 'a-vencer' && 'Ausências a Vencer (próximos 30 dias)'}
              {filtroAtivo === 'vencidas' && 'Ausências Vencidas'}
            </div>
            <button 
              className="btn btn-outline btn-sm" 
              onClick={handleExportExcel}
              disabled={listaFiltrada.length === 0}
              style={{ gap: '8px' }}
            >
              <FileSpreadsheet size={16} color="#1D6F42" />
              Exportar Lista
            </button>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Colaborador</th>
                  {filtroAtivo === 'em-ausencia' && <><th>Início</th><th>Término</th><th>Dias</th></>}
                  {(filtroAtivo === 'a-vencer' || filtroAtivo === 'vencidas') && <><th>Período Aquisitivo</th><th>Limite</th></>}
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map((item, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{item.nome}</td>
                    {filtroAtivo === 'em-ausencia' && (
                      <>
                        <td>{formatarData(item.dataInicio)}</td>
                        <td>{formatarData(item.dataTermino)}</td>
                        <td>{item.diasAusencia} dias</td>
                      </>
                    )}
                    {(filtroAtivo === 'a-vencer' || filtroAtivo === 'vencidas') && (
                      <>
                        <td>{formatarData(item.inicio_pa)} - {formatarData(item.fim_pa)}</td>
                        <td style={{ color: item.tipo === 'vencidas' ? 'var(--color-danger)' : 'inherit', fontWeight: item.tipo === 'vencidas' ? 600 : 400 }}>
                          {formatarData(item.limite_efetiva)}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="absence-mobile-list">
            {listaFiltrada.map((item, i) => (
              <div key={i} className="absence-mobile-card">
                <div className="absence-mobile-top">
                  <div className="absence-mobile-name">{item.nome}</div>
                  {item.tipo === 'vencidas' && <span className="badge reprovada">Vencida</span>}
                  {item.tipo === 'a-vencer' && <span className="badge pendente">A vencer</span>}
                  {item.tipo === 'em-ausencia' && <span className="badge ativo">Em ausência</span>}
                </div>

                {filtroAtivo === 'em-ausencia' && (
                  <div className="absence-mobile-meta">
                    <div className="absence-mobile-meta-item">
                      <span className="label">Início</span>
                      <span className="value">{formatarData(item.dataInicio)}</span>
                    </div>
                    <div className="absence-mobile-meta-item">
                      <span className="label">Término</span>
                      <span className="value">{formatarData(item.dataTermino)}</span>
                    </div>
                    <div className="absence-mobile-meta-item">
                      <span className="label">Dias</span>
                      <span className="value">{item.diasAusencia} dias</span>
                    </div>
                  </div>
                )}

                {(filtroAtivo === 'a-vencer' || filtroAtivo === 'vencidas') && (
                  <div className="absence-mobile-meta">
                    <div className="absence-mobile-meta-item">
                      <span className="label">Período aquisitivo</span>
                      <span className="value">{formatarData(item.inicio_pa)} - {formatarData(item.fim_pa)}</span>
                    </div>
                    <div className="absence-mobile-meta-item">
                      <span className="label">Limite</span>
                      <span className="value">{formatarData(item.limite_efetiva)}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {listaFiltrada.length === 0 && (
            <div className="table-empty">Nenhum colaborador nesta categoria.</div>
          )}
        </div>
      )}

      <div className="timeline-container">
        <div className="timeline-title">
          <Timer size={20} /> {escopoCalendario === 'todos' ? 'Calendário da Empresa' : 'Calendário da Equipe'}
        </div>

        <div className="calendar-scope-toggle">
          <button
            type="button"
            className={`btn btn-sm ${escopoCalendario === 'equipe' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setEscopoCalendario('equipe')}
          >
            <UserCheck size={15} /> Minha equipe
          </button>
          <button
            type="button"
            className={`btn btn-sm ${escopoCalendario === 'todos' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setEscopoCalendario('todos')}
          >
            <Users size={15} /> Todas as pessoas
          </button>
        </div>

        <div className="calendar-toolbar">
          <button className="btn btn-outline btn-sm" onClick={() => setMesReferencia((prev) => addMonths(prev, -1))}>
            Mês anterior
          </button>
          <div className="calendar-toolbar-title">{monthLabel}</div>
          <button className="btn btn-outline btn-sm" onClick={() => setMesReferencia((prev) => addMonths(prev, 1))}>
            Próximo mês
          </button>
        </div>

        <div className="calendar-legend">
          <span><strong>{calendarMonthRows.length}</strong> colaboradores com ausência no mês</span>
          <span><strong>{calendarMonthRows.reduce((acc, row) => acc + row.ausenciasNoMes.length, 0)}</strong> períodos no mês</span>
          <span className="calendar-legend-item"><i className="calendar-dot scheduled" /> Período agendado</span>
          <span className="calendar-legend-item"><i className="calendar-dot active" /> Em ausência</span>
        </div>

        {escopoCalendario === 'todos' && loadingTodos ? (
          <div className="table-empty" style={{ padding: 'var(--space-xl)' }}>
            Carregando ausências de toda a empresa…
          </div>
        ) : calendarMonthRows.length === 0 ? (
          <div className="table-empty" style={{ padding: 'var(--space-xl)' }}>
            Nenhuma ausência neste mês.
          </div>
        ) : (
          <>
          <div className="calendar-mobile-list">
            {calendarMonthRows.map((row) => (
              <div key={row.key} className="calendar-mobile-card">
                <div className="calendar-mobile-top">
                  <div className="calendar-mobile-name">{row.nome}</div>
                </div>

                <div className="calendar-mobile-periods">
                  {row.ausenciasNoMes.map((a) => (
                    <div key={a.id} className={`calendar-mobile-period ${a.isAbsent ? 'is-active' : ''}`}>
                      <span className="calendar-mobile-period-date">
                        {formatarData(a.inicio_ausencia)} - {formatarData(a.fim_ausencia)}
                      </span>
                      <span className="calendar-mobile-period-days">{a.dias_pendentes || 0} dias</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="calendar-grid-scroll">
            <div className="calendar-grid" style={{ gridTemplateColumns: `220px repeat(${monthDays.length}, minmax(34px, 1fr))` }}>
              <div className="calendar-sticky calendar-name-header">Colaborador</div>
              {monthDays.map((day) => (
                <div
                  key={day.toISOString()}
                  className={`calendar-day-header ${sameDay(day, hoje) ? 'today' : ''}`}
                >
                  <strong>{day.getDate()}</strong>
                  <span>{day.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3)}</span>
                </div>
              ))}

              {calendarMonthRows.map((row) => (
                <div key={row.key} className="calendar-row-group">
                  <div className="calendar-sticky calendar-name-cell">
                    <div className="calendar-name">{row.nome}</div>
                    <div className="calendar-period-list">
                      {row.ausenciasNoMes.map((a) => (
                        <span key={a.id}>
                          {formatarData(a.inicio_ausencia)} - {formatarData(a.fim_ausencia)}
                        </span>
                      ))}
                    </div>
                  </div>

                  {monthDays.map((day) => {
                    const activeAusencia = row.ausenciasNoMes.find((a) => getCellState(a, day));
                    const cellClass = activeAusencia
                      ? activeAusencia.isAbsent
                        ? 'filled active'
                        : 'filled'
                      : '';

                    return (
                      <div
                        key={`${row.key}-${day.toISOString()}`}
                        className={`calendar-day-cell ${sameDay(day, hoje) ? 'today' : ''} ${cellClass}`}
                        title={activeAusencia ? `${row.nome}: ${formatarData(activeAusencia.inicio_ausencia)} - ${formatarData(activeAusencia.fim_ausencia)}` : ''}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
