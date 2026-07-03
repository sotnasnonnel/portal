import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import {
  X, Loader2, CalendarClock, RotateCcw, Save, Plus, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import {
  formatarData, calcularSaldoAusencia, gerarCiclosTeoricos, DIAS_POR_PA,
} from '../../utils/formatters';
import '../../components/UI/Components.css';
import './Admin.css';

const hojeStr = () => new Date().toISOString().split('T')[0];

const diasEntre = (inicio, fim) => {
  if (!inicio || !fim) return 0;
  const a = new Date(inicio + 'T00:00:00');
  const b = new Date(fim + 'T00:00:00');
  const diff = Math.round((b - a) / 86400000) + 1;
  return diff > 0 ? diff : 0;
};

// Uma linha de ciclos_ausencia "está marcada" se tem datas de ausência agendada.
const temMarcacao = (row) => !!(row.ausencia_agendada_inicio && row.ausencia_agendada_fim);

export default function AdminAusenciasModal({ colaborador, onClose }) {
  const [ciclos, setCiclos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [erro, setErro] = useState('');
  // edição inline: { key, inicio, fim, dias }  — key = id da linha ou `new:<inicio_pa>`
  const [editando, setEditando] = useState(null);
  // direito sendo editado por P.A.: { [inicio_pa]: valor }
  const [direitos, setDireitos] = useState({});

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    const { data, error } = await supabase
      .from('ciclos_ausencia')
      .select('*')
      .eq('colaborador_id', colaborador.id)
      .order('inicio_periodo_aquisitivo', { ascending: true });
    if (error) setErro(error.message);
    setCiclos(data || []);
    setLoading(false);
  }, [colaborador.id]);

  useEffect(() => { carregar(); }, [carregar]);

  const { saldoPorPA } = useMemo(() => {
    const { periodos } = calcularSaldoAusencia(ciclos);
    return { saldoPorPA: Object.fromEntries(periodos.map((p) => [p.inicio_pa, p])) };
  }, [ciclos]);

  // Agrupa as linhas por período aquisitivo.
  const periodos = useMemo(() => {
    const grupos = {};
    ciclos.forEach((c) => {
      const key = c.inicio_periodo_aquisitivo;
      if (!grupos[key]) {
        grupos[key] = {
          inicio_pa: key,
          fim_pa: c.fim_periodo_aquisitivo,
          limite: c.limite_ausencia_efetiva,
          rows: [],
        };
      }
      grupos[key].rows.push(c);
    });
    return Object.values(grupos).sort((a, b) => a.inicio_pa.localeCompare(b.inicio_pa));
  }, [ciclos]);

  const fechar = () => { if (!savingKey) onClose(); };

  // ---- Ações -------------------------------------------------------------

  // Salvar/alterar datas de uma marcação (ou criar nova quando key começa com "new:")
  const salvarDatas = async (paInfo) => {
    if (!editando?.inicio || !editando?.fim) {
      alert('Informe a data de início e de término.');
      return;
    }
    if (editando.fim < editando.inicio) {
      alert('A data de término não pode ser anterior à de início.');
      return;
    }
    const dias = Number(editando.dias) || diasEntre(editando.inicio, editando.fim);
    const isNova = String(editando.key).startsWith('new:');
    setSavingKey(editando.key);
    let error;
    if (isNova) {
      ({ error } = await supabase.from('ciclos_ausencia').insert([{
        colaborador_id: colaborador.id,
        inicio_periodo_aquisitivo: paInfo.inicio_pa,
        fim_periodo_aquisitivo: paInfo.fim_pa,
        limite_ausencia_efetiva: paInfo.limite,
        ausencia_agendada_inicio: editando.inicio,
        ausencia_agendada_fim: editando.fim,
        dias_solicitados: dias,
        status_atual: 'Ausência Marcada',
      }]));
    } else {
      ({ error } = await supabase.from('ciclos_ausencia').update({
        ausencia_agendada_inicio: editando.inicio,
        ausencia_agendada_fim: editando.fim,
        dias_solicitados: dias,
        status_atual: 'Ausência Marcada',
        remarcacao_inicio_proposto: null,
        remarcacao_fim_proposto: null,
        justificativa_remarcacao: null,
      }).eq('id', editando.key));
    }
    setSavingKey(null);
    if (error) { alert('Não foi possível salvar: ' + error.message); return; }
    setEditando(null);
    await carregar();
  };

  // Devolver saldo: limpa a marcação; os dias voltam para o saldo do P.A.
  const devolverSaldo = async (row) => {
    const ok = window.confirm(
      'Devolver o saldo desta marcação? As datas serão limpas e os dias voltam para o saldo do período (o colaborador poderá marcar de novo).'
    );
    if (!ok) return;
    setSavingKey(row.id);
    const novoStatus = (row.fim_periodo_aquisitivo || '') > hojeStr() ? 'Sem direito ainda' : 'Marcação Pendente';
    const { error } = await supabase.from('ciclos_ausencia').update({
      ausencia_agendada_inicio: null,
      ausencia_agendada_fim: null,
      dias_solicitados: 0,
      remarcacao_inicio_proposto: null,
      remarcacao_fim_proposto: null,
      justificativa_remarcacao: null,
      status_atual: novoStatus,
    }).eq('id', row.id);
    setSavingKey(null);
    if (error) { alert('Não foi possível devolver o saldo: ' + error.message); return; }
    await carregar();
  };

  // Ajustar o direito de dias do período (recalcula o saldo automaticamente).
  const salvarDireito = async (paInfo) => {
    const valor = Number(direitos[paInfo.inicio_pa]);
    if (Number.isNaN(valor) || valor < 0) { alert('Informe um número de dias válido.'); return; }
    setSavingKey('dir:' + paInfo.inicio_pa);
    const ids = paInfo.rows.map((r) => r.id);
    const { error } = await supabase.from('ciclos_ausencia').update({ dias_direito: valor }).in('id', ids);
    setSavingKey(null);
    if (error) { alert('Não foi possível ajustar o direito: ' + error.message); return; }
    setDireitos((prev) => { const n = { ...prev }; delete n[paInfo.inicio_pa]; return n; });
    await carregar();
  };

  // Gera os períodos aquisitivos teóricos que ainda não existem (mesmo preenchimento
  // automático de 21 dias usado quando o colaborador acessa o painel).
  const gerarPeriodos = async () => {
    if (!colaborador.data_admissao) { alert('Colaborador sem data de admissão.'); return; }
    setSavingKey('gerar');
    const teoricos = gerarCiclosTeoricos(colaborador.data_admissao, 2);
    const existentes = new Set(ciclos.map((c) => c.inicio_periodo_aquisitivo));
    const novos = teoricos
      .filter((t) => !existentes.has(t.inicio_pa))
      .map((t) => ({
        colaborador_id: colaborador.id,
        inicio_periodo_aquisitivo: t.inicio_pa,
        fim_periodo_aquisitivo: t.fim_pa,
        limite_ausencia_efetiva: t.limite_efetiva,
        status_atual: 'Sem direito ainda',
        dias_solicitados: DIAS_POR_PA,
      }));
    if (novos.length === 0) { setSavingKey(null); alert('Nenhum período novo a gerar.'); return; }
    const { error } = await supabase
      .from('ciclos_ausencia')
      .upsert(novos, { onConflict: 'colaborador_id,inicio_periodo_aquisitivo' });
    setSavingKey(null);
    if (error) { alert('Não foi possível gerar os períodos: ' + error.message); return; }
    await carregar();
  };

  const abrirEdicao = (row) => setEditando({
    key: row.id,
    inicio: row.ausencia_agendada_inicio || '',
    fim: row.ausencia_agendada_fim || '',
    dias: row.dias_solicitados || diasEntre(row.ausencia_agendada_inicio, row.ausencia_agendada_fim),
  });

  const abrirNova = (paInfo) => setEditando({ key: 'new:' + paInfo.inicio_pa, inicio: '', fim: '', dias: '' });

  const setCampoEdicao = (campo, valor) => setEditando((prev) => {
    const next = { ...prev, [campo]: valor };
    if (campo === 'inicio' || campo === 'fim') next.dias = diasEntre(next.inicio, next.fim) || prev.dias;
    return next;
  });

  // ---- Render ------------------------------------------------------------

  const renderFormDatas = (paInfo) => (
    <div className="aus-form">
      <div className="form-group">
        <label className="form-label">Início</label>
        <input type="date" className="form-input" value={editando.inicio}
          onChange={(e) => setCampoEdicao('inicio', e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Término</label>
        <input type="date" className="form-input" value={editando.fim}
          onChange={(e) => setCampoEdicao('fim', e.target.value)} />
      </div>
      <div className="form-group aus-form-dias">
        <label className="form-label">Dias</label>
        <input type="number" min="0" className="form-input" value={editando.dias}
          onChange={(e) => setCampoEdicao('dias', e.target.value)} />
      </div>
      <div className="aus-form-actions">
        <button className="btn btn-outline btn-sm" type="button" onClick={() => setEditando(null)}
          disabled={savingKey === editando.key}>Cancelar</button>
        <button className="btn btn-primary btn-sm" type="button" onClick={() => salvarDatas(paInfo)}
          disabled={savingKey === editando.key}>
          {savingKey === editando.key ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Salvar
        </button>
      </div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={fechar}>
      <div className="modal admin-aus-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">
            <CalendarClock size={18} style={{ verticalAlign: '-3px', marginRight: 6 }} />
            Férias / Ausências — {colaborador.nome}
          </span>
          <button className="modal-close" onClick={fechar} disabled={!!savingKey}><X size={18} /></button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="table-empty"><Loader2 size={22} className="animate-spin" /> Carregando períodos…</div>
          ) : erro ? (
            <div className="aus-erro">Erro ao carregar: {erro}</div>
          ) : periodos.length === 0 ? (
            <div className="table-empty" style={{ display: 'grid', gap: 12, justifyItems: 'center' }}>
              <span>Nenhum período aquisitivo cadastrado para este colaborador.</span>
              <button className="btn btn-primary btn-sm" onClick={gerarPeriodos} disabled={savingKey === 'gerar'}>
                {savingKey === 'gerar' ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                Gerar períodos (21 dias)
              </button>
            </div>
          ) : (
            <div className="aus-periodos">
              {periodos.map((pa) => {
                const saldo = saldoPorPA[pa.inicio_pa];
                const direito = saldo?.direito ?? DIAS_POR_PA;
                const saldoDias = saldo?.saldo ?? direito;
                const marcacoes = pa.rows.filter(temMarcacao);
                const vencido = (pa.limite || '') && pa.limite < hojeStr();
                return (
                  <div key={pa.inicio_pa} className="aus-pa-card">
                    <div className="aus-pa-head">
                      <div>
                        <div className="aus-pa-titulo">
                          Período {formatarData(pa.inicio_pa)} — {formatarData(pa.fim_pa)}
                          {vencido && <span className="badge reprovada" style={{ marginLeft: 8 }}>Vencido</span>}
                        </div>
                        <div className="aus-pa-sub">Limite para gozo: {formatarData(pa.limite)}</div>
                      </div>
                      <div className={`aus-saldo ${saldoDias < 0 ? 'is-neg' : ''}`}>
                        <strong>{saldoDias}</strong>
                        <span>dias de saldo</span>
                      </div>
                    </div>

                    <div className="aus-direito">
                      <label className="form-label">Direito do período (dias)</label>
                      <div className="aus-direito-row">
                        <input
                          type="number" min="0" className="form-input"
                          value={direitos[pa.inicio_pa] ?? direito}
                          onChange={(e) => setDireitos((p) => ({ ...p, [pa.inicio_pa]: e.target.value }))}
                        />
                        <button className="btn btn-outline btn-sm" type="button"
                          onClick={() => salvarDireito(pa)}
                          disabled={savingKey === 'dir:' + pa.inicio_pa || direitos[pa.inicio_pa] == null || Number(direitos[pa.inicio_pa]) === direito}>
                          {savingKey === 'dir:' + pa.inicio_pa ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                          Ajustar saldo
                        </button>
                      </div>
                    </div>

                    <div className="aus-marcacoes">
                      {marcacoes.length === 0 && editando?.key !== 'new:' + pa.inicio_pa && (
                        <div className="aus-vazio">Nenhuma férias marcada neste período.</div>
                      )}

                      {marcacoes.map((row) => {
                        const passou = (row.ausencia_agendada_fim || '') && row.ausencia_agendada_fim < hojeStr();
                        const emEdicao = editando?.key === row.id;
                        return (
                          <div key={row.id} className="aus-marcacao">
                            {emEdicao ? (
                              renderFormDatas(pa)
                            ) : (
                              <>
                                <div className="aus-marcacao-info">
                                  <span className="aus-marcacao-datas">
                                    {formatarData(row.ausencia_agendada_inicio)} → {formatarData(row.ausencia_agendada_fim)}
                                  </span>
                                  <span className="aus-marcacao-dias">{row.dias_solicitados || 0} dias</span>
                                  <span className={`badge ${row.status_atual === 'Ausência Marcada' ? 'ativo' : 'pendente'}`}>
                                    {row.status_atual}
                                  </span>
                                  {passou && (
                                    <span className="aus-flag" title="O período desta marcação já passou">
                                      <AlertTriangle size={13} /> já passou
                                    </span>
                                  )}
                                </div>
                                <div className="aus-marcacao-acoes">
                                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => abrirEdicao(row)}
                                    disabled={!!savingKey}>
                                    Alterar datas
                                  </button>
                                  <button className="btn btn-outline btn-sm" type="button" onClick={() => devolverSaldo(row)}
                                    disabled={savingKey === row.id}>
                                    {savingKey === row.id ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
                                    Devolver saldo
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}

                      {editando?.key === 'new:' + pa.inicio_pa ? (
                        <div className="aus-marcacao">{renderFormDatas(pa)}</div>
                      ) : (
                        <button className="btn btn-ghost btn-sm aus-add" type="button"
                          onClick={() => abrirNova(pa)} disabled={!!savingKey}>
                          <Plus size={15} /> Adicionar férias neste período
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              <div className="aus-rodape">
                <CheckCircle2 size={14} />
                Saldo = direito do período − dias já marcados. "Devolver saldo" limpa a marcação e libera os dias.
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={fechar} disabled={!!savingKey}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
