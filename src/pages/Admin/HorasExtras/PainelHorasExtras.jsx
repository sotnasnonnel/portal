import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock, Download, Repeat, Ban, CalendarCheck, ShieldAlert, X, AlertTriangle, Timer, Wallet,
} from 'lucide-react';
import {
  fetchSolicitacoes, fetchExcecoes, alterarDestino, cancelar, marcarCompensada,
} from '../../../services/horasExtras';
import {
  DESTINO_LABEL, PERIODO_LABEL, PRAZO_COMPENSACAO_DIAS, LIMITE_PADRAO,
  fmtDataBr, fmtHora, fmtMin, horaParaMin, janelaCompensacao, periodoUltimosDias,
  podeAlterarDestino, podeCancelar, podeCompensar, rotuloPrazo, situacaoCompensacao,
  statusLabel, validarCompensacao,
} from '../../../config/horasExtras';
import '../../../components/UI/Components.css';
import '../Admin.css';
import './HorasExtras.css';

// Painel DP das horas extras (módulo Gestão de Pessoas).
// O DP vê todas as solicitações da empresa, altera o destino da hora, cancela,
// marca o banco de horas como compensado e exporta para a folha. O pedido, o
// acompanhamento e a aprovação ficam no Controle de Horas.
// A RLS (app_private.is_horas_extras_dp) é quem garante o acesso de verdade.
export default function PainelHorasExtras() {
  const [list, setList] = useState([]);
  const [excecoes, setExcecoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [range, setRange] = useState(() => periodoUltimosDias(60));
  const [filtro, setFiltro] = useState('todos');
  const [aAlterar, setAAlterar] = useState(null);
  const [aCancelar, setACancelar] = useState(null);

  const carregar = useCallback(async () => {
    setErro('');
    try {
      const [rows, excs] = await Promise.all([
        fetchSolicitacoes({ de: range.de, ate: range.ate }),
        fetchExcecoes(),
      ]);
      setList(rows);
      setExcecoes(excs);
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar o painel.');
    } finally {
      setLoading(false);
    }
  }, [range.de, range.ate]);

  useEffect(() => { carregar(); }, [carregar]);

  // Situação do prazo de 180 dias, calculada uma vez por linha.
  const comPrazo = useMemo(
    () => list.map((s) => ({ ...s, prazo: situacaoCompensacao(s) })),
    [list]
  );

  const filtrado = useMemo(() => {
    if (filtro === 'todos') return comPrazo;
    if (filtro === 'vencendo') return comPrazo.filter((s) => s.prazo?.estado === 'vencendo');
    if (filtro === 'vencido') return comPrazo.filter((s) => s.prazo?.estado === 'vencido');
    if (filtro === 'medicao') return comPrazo.filter((s) => s.destino === 'medicao' && s.status !== 'cancelada');
    if (filtro === 'banco') return comPrazo.filter((s) => s.destino === 'banco' && s.status === 'aprovada');
    return comPrazo.filter((s) => s.status === filtro);
  }, [comPrazo, filtro]);

  const stats = useMemo(() => ({
    total: comPrazo.length,
    pendentes: comPrazo.filter((s) => s.status === 'pendente').length,
    medicao: comPrazo.filter((s) => s.destino === 'medicao' && s.status !== 'cancelada').length,
    banco: comPrazo.filter((s) => s.destino === 'banco' && s.status === 'aprovada').length,
    vencendo: comPrazo.filter((s) => s.prazo?.estado === 'vencendo').length,
    vencido: comPrazo.filter((s) => s.prazo?.estado === 'vencido').length,
    excecoes: excecoes.filter((e) => e.ativa).length,
  }), [comPrazo, excecoes]);

  async function compensar(s) {
    try {
      await marcarCompensada(s.id);
      await carregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao marcar como compensada.');
    }
  }

  // Exportação para a folha. Sem percentual — quem aplica é o DP/RM, pela CCT.
  function exportarCSV() {
    const head = [
      'Numero', 'Colaborador', 'Matricula', 'Cargo', 'Projeto', 'Equipe', 'Centro de Custo',
      'Data', 'Inicio', 'Fim', 'Total (HH:MM)', 'Total (min)', 'Destino', 'Status',
      'Compensacao Data', 'Compensacao Periodo', 'Compensacao (HH:MM)',
      'Prazo Limite', 'Dias Restantes', 'Situacao Prazo',
      'Motivo', 'Justificativa', 'Aprovador', 'Decidido Em', 'Decidido Por',
      'Motivo Reprovacao', 'Motivo Alteracao',
    ];
    const rows = filtrado.map((s) => [
      s.numero, s.colaborador_nome, s.matricula || '', s.cargo || '',
      s.projeto_nome || '', s.gerencia_nome || '', s.centro_custo || '',
      fmtDataBr(s.data_he), fmtHora(s.hora_inicio), fmtHora(s.hora_fim),
      fmtMin(s.minutos), s.minutos,
      s.destino ? DESTINO_LABEL[s.destino] : '',
      statusLabel(s.status, s.destino),
      s.compensacao_data ? fmtDataBr(s.compensacao_data) : '',
      s.compensacao_periodo ? PERIODO_LABEL[s.compensacao_periodo] : '',
      s.compensacao_minutos != null ? fmtMin(s.compensacao_minutos) : '',
      s.prazo ? fmtDataBr(s.prazo.vencimento) : '',
      s.prazo ? s.prazo.dias : '',
      s.prazo ? s.prazo.estado : '',
      s.motivo, (s.justificativa || '').replace(/[\n;]/g, ' '),
      s.aprovador_nome || '',
      s.decidido_em ? new Date(s.decidido_em).toLocaleString('pt-BR') : '',
      s.decidido_por_nome || '',
      (s.motivo_reprovacao || '').replace(/[\n;]/g, ' '),
      (s.motivo_alteracao || '').replace(/[\n;]/g, ' '),
    ]);
    const csv = [head, ...rows]
      .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'horas_extras_phd.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const FILTROS = [
    ['todos', 'Todas'],
    ['pendente', 'Pendentes'],
    ['medicao', 'Medição'],
    ['banco', 'Banco de horas'],
    ['vencendo', 'Prazo vencendo'],
    ['vencido', 'Prazo vencido'],
    ['compensada', 'Compensadas'],
    ['reprovada', 'Reprovadas'],
    ['cancelada', 'Canceladas'],
  ];

  if (loading) {
    return (
      <div className="admin-page animate-fade-in-up">
        <h1 className="page-title"><Clock size={28} /> Horas Extras</h1>
        <div style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}>Carregando dados...</div>
      </div>
    );
  }

  return (
    <div className="admin-page animate-fade-in-up">
      <h1 className="page-title"><Clock size={28} /> Horas Extras</h1>
      <p className="page-subtitle">
        Solicitações da empresa toda. Prazo do pedido: até {LIMITE_PADRAO} do próprio dia, sem
        retroativo. Banco de horas: compensar em até {PRAZO_COMPENSACAO_DIAS} dias da hora extra.
      </p>

      {erro && <div className="he-alerta he-alerta--erro">{erro}</div>}

      <div className="cards-grid" style={{ marginBottom: 'var(--space-xl)' }}>
        <StatCard tom="accent" icone={<Clock size={22} />} valor={stats.total} rotulo="Solicitações"
          ativo={filtro === 'todos'} onClick={() => setFiltro('todos')} />
        <StatCard tom="warning" icone={<Timer size={22} />} valor={stats.pendentes} rotulo="Pendentes"
          ativo={filtro === 'pendente'} onClick={() => setFiltro('pendente')} />
        <StatCard tom="success" icone={<Wallet size={22} />} valor={stats.medicao} rotulo="Medição/Pagamento"
          ativo={filtro === 'medicao'} onClick={() => setFiltro('medicao')} />
        <StatCard tom="accent" icone={<CalendarCheck size={22} />} valor={stats.banco} rotulo="Banco de horas"
          ativo={filtro === 'banco'} onClick={() => setFiltro('banco')} />
        <StatCard tom="warning" icone={<AlertTriangle size={22} />} valor={stats.vencendo} rotulo="Prazo vencendo"
          ativo={filtro === 'vencendo'} onClick={() => setFiltro('vencendo')} />
        <StatCard tom="danger" icone={<AlertTriangle size={22} />} valor={stats.vencido} rotulo="Prazo vencido"
          ativo={filtro === 'vencido'} onClick={() => setFiltro('vencido')} />
      </div>

      {stats.vencido > 0 && (
        <div className="he-alerta he-alerta--erro">
          <AlertTriangle size={16} />
          {stats.vencido} hora(s) extra(s) em banco de horas passaram dos {PRAZO_COMPENSACAO_DIAS}{' '}
          dias sem compensação. Trate com o gestor: o prazo legal já venceu.
        </div>
      )}

      <div className="table-container">
        <div className="table-header">
          <div className="table-header-title">Solicitações</div>
          <div className="he-toolbar">
            <div className="form-group he-campo-data">
              <label className="form-label">De</label>
              <input className="form-input" type="date" value={range.de}
                onChange={(e) => setRange((r) => ({ ...r, de: e.target.value }))} />
            </div>
            <div className="form-group he-campo-data">
              <label className="form-label">Até</label>
              <input className="form-input" type="date" value={range.ate}
                onChange={(e) => setRange((r) => ({ ...r, ate: e.target.value }))} />
            </div>
            <Link className="btn btn-outline" to="/admin/horas-extras/excecoes">
              <ShieldAlert size={18} /> Exceções ({stats.excecoes})
            </Link>
            <button className="btn btn-outline" onClick={exportarCSV} disabled={!filtrado.length}>
              <Download size={18} /> Exportar CSV
            </button>
          </div>
        </div>

        <div className="filter-chips" style={{ padding: '0 var(--space-lg) var(--space-md)' }}>
          {FILTROS.map(([v, l]) => (
            <button key={v} className={`filter-chip ${filtro === v ? 'active' : ''}`}
              onClick={() => setFiltro(v)}>
              {l}
            </button>
          ))}
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Colaborador</th>
                <th>Projeto/Equipe</th>
                <th>Data</th>
                <th>Horário</th>
                <th>Total</th>
                <th>Destino</th>
                <th>Status</th>
                <th>Compensação</th>
                <th>Prazo</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrado.map((s) => (
                <tr key={s.id}>
                  <td>#{s.numero}</td>
                  <td>
                    {s.colaborador_nome}
                    <div className="he-sub">{[s.matricula, s.cargo].filter(Boolean).join(' · ') || '—'}</div>
                  </td>
                  <td>
                    {s.projeto_nome || '—'}
                    <div className="he-sub">{[s.gerencia_nome, s.centro_custo].filter(Boolean).join(' | ') || '—'}</div>
                  </td>
                  <td>{fmtDataBr(s.data_he)}</td>
                  <td>{fmtHora(s.hora_inicio)} às {fmtHora(s.hora_fim)}</td>
                  <td className="he-num">{fmtMin(s.minutos)}</td>
                  <td>
                    {s.destino ? DESTINO_LABEL[s.destino] : '—'}
                    <div className="he-sub">Percentual conforme CCT/DP</div>
                  </td>
                  <td><span className={`badge ${badgeStatus(s.status)}`}>{statusLabel(s.status, s.destino)}</span></td>
                  <td>
                    {s.compensacao_data ? (
                      <>
                        {fmtDataBr(s.compensacao_data)}
                        <div className="he-sub">
                          {PERIODO_LABEL[s.compensacao_periodo] || s.compensacao_periodo} ·{' '}
                          {fmtMin(s.compensacao_minutos)}
                        </div>
                      </>
                    ) : '—'}
                  </td>
                  <td>
                    {s.prazo ? (
                      <span className={`he-prazo he-prazo--${s.prazo.estado}`}>{rotuloPrazo(s.prazo)}</span>
                    ) : <span className="he-sub">—</span>}
                  </td>
                  <td>
                    <div className="table-actions">
                      {podeAlterarDestino(s) && (
                        <button className="btn-icon" title="Alterar destino da hora"
                          onClick={() => setAAlterar(s)}>
                          <Repeat size={16} />
                        </button>
                      )}
                      {podeCompensar(s) && (
                        <button className="btn-icon" title="Marcar como compensada"
                          onClick={() => compensar(s)}>
                          <CalendarCheck size={16} />
                        </button>
                      )}
                      {podeCancelar(s) && (
                        <button className="btn-icon" title="Cancelar solicitação"
                          onClick={() => setACancelar(s)}>
                          <Ban size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtrado.length === 0 && (
                <tr>
                  <td colSpan={11} className="table-empty">Nenhuma solicitação encontrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {aAlterar && (
        <ModalDestino
          solicitacao={aAlterar}
          onClose={() => setAAlterar(null)}
          onConfirm={async (payload) => {
            await alterarDestino(aAlterar.id, payload);
            setAAlterar(null);
            await carregar();
          }}
        />
      )}

      {aCancelar && (
        <ModalMotivo
          titulo={`Cancelar solicitação #${aCancelar.numero}`}
          descricao={`${aCancelar.colaborador_nome} · ${fmtDataBr(aCancelar.data_he)} · ${fmtMin(aCancelar.minutos)}.`}
          rotulo="Motivo do cancelamento"
          confirmar="Cancelar solicitação"
          onClose={() => setACancelar(null)}
          onConfirm={async (motivo) => {
            await cancelar(aCancelar.id, { motivo });
            setACancelar(null);
            await carregar();
          }}
        />
      )}
    </div>
  );
}

// Reaproveita as classes de badge do DP (só existem 5 tons lá).
function badgeStatus(status) {
  if (status === 'aprovada' || status === 'compensada') return 'aprovada';
  if (status === 'reprovada') return 'reprovada';
  if (status === 'cancelada') return 'inativo';
  return 'pendente';
}

// `icone` chega como elemento pronto (<Clock size={22} />), não como componente:
// o projeto não usa eslint-plugin-react, então um componente recebido por prop
// e usado só em JSX seria acusado de variável não utilizada.
function StatCard({ tom, icone, valor, rotulo, ativo, onClick }) {
  return (
    <div className={`stat-card ${tom} ${ativo ? 'is-active' : ''}`} onClick={onClick}>
      <div className="stat-card-header">
        <div className="stat-card-icon">{icone}</div>
      </div>
      <div className="stat-card-value">{valor}</div>
      <div className="stat-card-label">{rotulo}</div>
    </div>
  );
}

// Alteração do destino da hora pelo DP: sempre com motivo (vai para a auditoria).
// Banco de horas exige a previsão de compensação dentro dos 180 dias.
function ModalDestino({ solicitacao, onClose, onConfirm }) {
  const [destino, setDestino] = useState(solicitacao.destino || 'medicao');
  const [data, setData] = useState(solicitacao.compensacao_data || solicitacao.data_he || '');
  const [periodo, setPeriodo] = useState(solicitacao.compensacao_periodo || 'dia_inteiro');
  const [qtd, setQtd] = useState(fmtMin(solicitacao.compensacao_minutos ?? solicitacao.minutos));
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const ehBanco = destino === 'banco';
  const janela = janelaCompensacao(solicitacao.data_he);
  const prazo = validarCompensacao({ dataHe: solicitacao.data_he, dataCompensacao: data });

  async function submit() {
    if (!motivo.trim()) return setErro('Informe o motivo da alteração.');
    const minutos = horaParaMin(qtd);
    if (ehBanco) {
      if (!prazo.ok) return setErro(prazo.msg);
      if (!minutos) return setErro('Informe a quantidade prevista para compensação (ex.: 02:00).');
    }
    setErro('');
    setSalvando(true);
    try {
      await onConfirm({
        destino,
        compensacao: ehBanco ? { data, periodo, minutos } : null,
        motivo: motivo.trim(),
      });
    } catch (e) {
      setErro(e?.message || 'Falha ao salvar.');
      setSalvando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Alterar destino da solicitação #{solicitacao.numero}</span>
          <button className="modal-close" onClick={onClose} disabled={salvando}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p className="he-modal-sub">
            {solicitacao.colaborador_nome} · {fmtDataBr(solicitacao.data_he)} ·{' '}
            {fmtMin(solicitacao.minutos)} de hora extra
          </p>

          <div className="form-group">
            <label className="form-label">Destino da hora</label>
            <select className="form-select" value={destino} onChange={(e) => setDestino(e.target.value)}>
              <option value="medicao">{DESTINO_LABEL.medicao}</option>
              <option value="banco">{DESTINO_LABEL.banco}</option>
            </select>
          </div>

          {ehBanco && (
            <>
              <div className="form-group">
                <label className="form-label">
                  Data prevista para compensação (até {PRAZO_COMPENSACAO_DIAS} dias)
                </label>
                <input className="form-input" type="date" value={data}
                  min={janela.min} max={janela.max}
                  onChange={(e) => setData(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Período previsto</label>
                <select className="form-select" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
                  {Object.entries(PERIODO_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Quantidade prevista (HH:MM)</label>
                <input className="form-input" type="time" value={qtd}
                  onChange={(e) => setQtd(e.target.value)} />
              </div>
              <div className={`he-alerta ${prazo.ok ? 'he-alerta--ok' : 'he-alerta--erro'}`}>
                {prazo.msg}
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">Motivo da alteração</label>
            <textarea className="form-input" rows={2} value={motivo}
              onChange={(e) => setMotivo(e.target.value)} />
          </div>

          <p className="form-hint">
            O percentual da hora não é definido aqui — o DP/RM aplica conforme a CCT vigente.
          </p>

          {erro && <div className="he-alerta he-alerta--erro">{erro}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={salvando}>Voltar</button>
          <button className="btn btn-primary" onClick={submit}
            disabled={salvando || (ehBanco && !prazo.ok)}>
            {salvando ? 'Salvando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Motivo obrigatório antes de uma ação irreversível (cancelar).
function ModalMotivo({ titulo, descricao, rotulo, confirmar, onClose, onConfirm }) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function submit() {
    if (!motivo.trim()) return setErro(`${rotulo} é obrigatório.`);
    setErro('');
    setSalvando(true);
    try {
      await onConfirm(motivo.trim());
    } catch (e) {
      setErro(e?.message || 'Falha ao salvar.');
      setSalvando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{titulo}</span>
          <button className="modal-close" onClick={onClose} disabled={salvando}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {descricao && <p className="he-modal-sub">{descricao}</p>}
          <div className="form-group">
            <label className="form-label">{rotulo}</label>
            <textarea className="form-input" rows={3} value={motivo}
              onChange={(e) => setMotivo(e.target.value)} autoFocus />
          </div>
          {erro && <div className="he-alerta he-alerta--erro">{erro}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={salvando}>Voltar</button>
          <button className="btn btn-danger" onClick={submit} disabled={salvando}>
            {salvando ? 'Salvando...' : confirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
