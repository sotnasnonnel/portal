import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Repeat, Ban, CalendarCheck, ShieldAlert } from 'lucide-react';
import {
  fetchSolicitacoes,
  fetchExcecoes,
  alterarDestino,
  cancelar,
  marcarCompensada,
} from '../../../lib/dataHorasExtras';
import {
  DESTINO_LABEL,
  PERIODO_LABEL,
  LIMITE_PADRAO,
  fmtDataBr,
  fmtHora,
  fmtMin,
  periodoUltimosDias,
  podeAlterarDestino,
  podeCancelar,
  podeCompensar,
  statusLabel,
} from '../../../lib/horasExtras';
import SolicitacoesHETable from '../../components/SolicitacoesHETable';
import DestinoHEModal from '../../components/DestinoHEModal';
import MotivoHEModal from '../../components/MotivoHEModal';

// Painel DP/Admin: vê todas as solicitações, altera o destino da hora, cancela,
// marca o banco de horas como compensado e exporta para a folha. A RLS é quem
// garante o acesso (app_private.is_horas_extras_dp).
export default function PainelDpHEPage() {
  const [list, setList] = useState([]);
  const [excecoes, setExcecoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [range, setRange] = useState(() => periodoUltimosDias(60));
  const [filtro, setFiltro] = useState({ status: '', destino: '' });
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

  useEffect(() => {
    carregar();
  }, [carregar]);

  const filtrado = useMemo(() => {
    let f = list;
    if (filtro.status) f = f.filter((s) => s.status === filtro.status);
    if (filtro.destino) f = f.filter((s) => s.destino === filtro.destino);
    return f;
  }, [list, filtro]);

  const stats = useMemo(
    () => ({
      total: list.length,
      pendentes: list.filter((s) => s.status === 'pendente').length,
      medicao: list.filter((s) => s.destino === 'medicao' && s.status !== 'cancelada').length,
      banco: list.filter((s) => s.destino === 'banco' && s.status === 'aprovada').length,
      minutosMedicao: list
        .filter((s) => s.destino === 'medicao' && s.status !== 'cancelada')
        .reduce((soma, s) => soma + (s.minutos || 0), 0),
      excecoes: excecoes.filter((e) => e.ativa).length,
    }),
    [list, excecoes]
  );

  async function confirmarAlteracao({ destino, compensacao, motivo }) {
    await alterarDestino(aAlterar.id, { destino, compensacao, motivo });
    setAAlterar(null);
    await carregar();
  }

  async function confirmarCancelamento(motivo) {
    await cancelar(aCancelar.id, { motivo });
    setACancelar(null);
    await carregar();
  }

  async function compensar(s) {
    try {
      await marcarCompensada(s.id);
      await carregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao marcar como compensada.');
    }
  }

  // Exportação para a folha: uma linha por solicitação, com o previsto de
  // compensação. Sem percentual — quem aplica é o DP/RM, conforme a CCT.
  function exportarCSV() {
    const head = [
      'Numero', 'Colaborador', 'Matricula', 'Cargo', 'Projeto', 'Equipe', 'Centro de Custo',
      'Data', 'Inicio', 'Fim', 'Total (HH:MM)', 'Total (min)', 'Destino', 'Status',
      'Compensacao Data', 'Compensacao Periodo', 'Compensacao (HH:MM)',
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

  const acoes = (s) => (
    <>
      {podeAlterarDestino(s) ? (
        <button
          className="horas-btn2 horas-btn-sm"
          type="button"
          title="Alterar destino da hora"
          onClick={() => setAAlterar(s)}
        >
          <Repeat size={14} /> Destino
        </button>
      ) : null}{' '}
      {podeCompensar(s) ? (
        <button
          className="horas-btn grn horas-btn-sm"
          type="button"
          title="Marcar como compensada"
          onClick={() => compensar(s)}
        >
          <CalendarCheck size={14} /> Compensada
        </button>
      ) : null}{' '}
      {podeCancelar(s) ? (
        <button
          className="horas-btn2 horas-btn-sm"
          type="button"
          title="Cancelar solicitação"
          onClick={() => setACancelar(s)}
        >
          <Ban size={14} /> Cancelar
        </button>
      ) : null}
    </>
  );

  return (
    <>
      <h1>Painel DP/Admin — Horas Extras</h1>
      <p className="horas-sub">
        Todas as solicitações da empresa. Regra padrão de prazo: até <b>{LIMITE_PADRAO}</b> do
        próprio dia, sem retroativo.
      </p>

      <div className="horas-hint">
        Aqui você altera o destino da hora (sempre com motivo), cancela uma solicitação, marca o
        banco de horas como compensado e exporta para a folha. Para liberar prazo, use a{' '}
        <Link to="/horas/extras/excecoes">Central de Exceções</Link>.
      </div>

      {erro ? <div className="horas-hint is-erro">⚠️ {erro}</div> : null}

      <div className="horas-stats">
        <Stat k="Solicitações" v={stats.total} />
        <Stat k="Pendentes" v={stats.pendentes} />
        <Stat k="Medição/Pagamento" v={stats.medicao} />
        <Stat k="Banco de horas" v={stats.banco} />
        <Stat k="Horas p/ medição" v={fmtMin(stats.minutosMedicao)} />
        <Stat k="Exceções ativas" v={stats.excecoes} />
      </div>

      <div className="horas-card">
        <div className="horas-toolbar" style={{ marginBottom: 0 }}>
          <div className="horas-fld" style={{ maxWidth: 150 }}>
            <label>De</label>
            <input
              type="date"
              value={range.de}
              onChange={(e) => setRange((r) => ({ ...r, de: e.target.value }))}
            />
          </div>
          <div className="horas-fld" style={{ maxWidth: 150 }}>
            <label>Até</label>
            <input
              type="date"
              value={range.ate}
              onChange={(e) => setRange((r) => ({ ...r, ate: e.target.value }))}
            />
          </div>
          <div className="horas-fld" style={{ maxWidth: 200 }}>
            <label>Status</label>
            <select
              value={filtro.status}
              onChange={(e) => setFiltro((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">Todos</option>
              <option value="pendente">Pendente de aprovação</option>
              <option value="aprovada">Aprovada</option>
              <option value="reprovada">Reprovada</option>
              <option value="compensada">Compensada</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>
          <div className="horas-fld" style={{ maxWidth: 200 }}>
            <label>Destino</label>
            <select
              value={filtro.destino}
              onChange={(e) => setFiltro((f) => ({ ...f, destino: e.target.value }))}
            >
              <option value="">Todos</option>
              <option value="medicao">{DESTINO_LABEL.medicao}</option>
              <option value="banco">{DESTINO_LABEL.banco}</option>
            </select>
          </div>
          <div className="horas-spacer" />
          <Link className="horas-btn2" to="/horas/extras/excecoes">
            <ShieldAlert size={16} /> Exceções
          </Link>
          <button
            className="horas-btn2"
            type="button"
            onClick={exportarCSV}
            disabled={!filtrado.length}
          >
            <Download size={16} /> Exportar CSV
          </button>
        </div>
      </div>

      <div className="horas-card horas-table-wrap">
        {loading ? (
          <div className="horas-empty">Carregando…</div>
        ) : (
          <SolicitacoesHETable list={filtrado} mostraColaborador acoes={acoes} />
        )}
      </div>

      {aAlterar ? (
        <DestinoHEModal
          solicitacao={aAlterar}
          titulo="Alterar destino da solicitação"
          pedeMotivo
          onClose={() => setAAlterar(null)}
          onConfirm={confirmarAlteracao}
        />
      ) : null}

      {aCancelar ? (
        <MotivoHEModal
          titulo={`Cancelar solicitação #${aCancelar.numero}`}
          descricao={`${aCancelar.colaborador_nome} · ${fmtDataBr(aCancelar.data_he)} · ${fmtMin(aCancelar.minutos)}.`}
          rotulo="Motivo do cancelamento"
          confirmar="Cancelar solicitação"
          perigo
          onClose={() => setACancelar(null)}
          onConfirm={confirmarCancelamento}
        />
      ) : null}
    </>
  );
}

function Stat({ k, v }) {
  return (
    <div className="horas-stat">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
    </div>
  );
}
