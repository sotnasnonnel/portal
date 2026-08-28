import {
  fmtDataBr,
  fmtHora,
  fmtMin,
  statusLabel,
  statusClasse,
  DESTINO_LABEL,
  PERIODO_LABEL,
} from '../../../../config/horasExtras';

// Tabela de solicitações de hora extra, reutilizada em Minhas / Aprovações /
// Painel DP. As linhas vêm da RPC horas_extras_listar (nomes já resolvidos).
//  - mostraColaborador: exibe a coluna Colaborador (aprovações e DP)
//  - acoes(s): JSX dos botões da linha; sem ele, a coluna de ações não existe
export default function SolicitacoesHETable({ list, mostraColaborador = false, acoes }) {
  if (!list.length) return <div className="horas-empty">Nenhuma solicitação encontrada.</div>;

  return (
    <table className="horas-tbl-resp">
      <thead>
        <tr>
          <th>#</th>
          {mostraColaborador ? <th>Colaborador</th> : null}
          <th>Projeto/Equipe</th>
          <th>Data</th>
          <th>Horário</th>
          <th className="horas-right">Total</th>
          <th>Destino</th>
          <th>Status</th>
          <th>Justificativa/Compensação</th>
          {acoes ? <th></th> : null}
        </tr>
      </thead>
      <tbody>
        {list.map((s) => (
          <tr key={s.id}>
            <td data-label="#">#{s.numero}</td>
            {mostraColaborador ? (
              <td data-label="Colaborador">
                {s.colaborador_nome}
                <div className="horas-muted" style={{ fontSize: 'var(--font-size-2xs)' }}>
                  {[s.matricula, s.cargo].filter(Boolean).join(' · ') || '—'}
                </div>
              </td>
            ) : null}
            <td data-label="Projeto/Equipe">
              {s.projeto_nome || '—'}
              <div className="horas-muted" style={{ fontSize: 'var(--font-size-2xs)' }}>
                {[s.gerencia_nome, s.centro_custo].filter(Boolean).join(' | ') || '—'}
              </div>
            </td>
            <td className="horas-muted" data-label="Data">{fmtDataBr(s.data_he)}</td>
            <td className="horas-muted" data-label="Horário">
              {fmtHora(s.hora_inicio)} às {fmtHora(s.hora_fim)}
            </td>
            <td className="horas-right" data-label="Total" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {fmtMin(s.minutos)}
            </td>
            <td data-label="Destino">
              {s.destino ? DESTINO_LABEL[s.destino] : '—'}
              {/* O percentual nunca vem do gestor: é aplicado pelo DP/RM conforme a CCT. */}
              <div className="horas-muted" style={{ fontSize: 'var(--font-size-2xs)' }}>
                Percentual conforme CCT/DP
              </div>
            </td>
            <td data-label="Status">
              <span className={`horas-he-badge ${statusClasse(s.status, s.destino)}`}>
                {statusLabel(s.status, s.destino)}
              </span>
            </td>
            <td data-label="Justificativa/Compensação" style={{ maxWidth: 300 }}>
              <div style={{ fontSize: 'var(--font-size-xs)' }}>
                <b>{s.motivo}</b> — {s.justificativa}
              </div>
              {s.compensacao_data ? (
                <div className="horas-muted" style={{ fontSize: 'var(--font-size-2xs)', marginTop: 3 }}>
                  <b>Compensação:</b> {fmtDataBr(s.compensacao_data)} ·{' '}
                  {PERIODO_LABEL[s.compensacao_periodo] || s.compensacao_periodo} ·{' '}
                  {fmtMin(s.compensacao_minutos)}
                </div>
              ) : null}
              {s.observacao_destino ? (
                <div className="horas-muted" style={{ fontSize: 'var(--font-size-2xs)', marginTop: 3 }}>
                  <b>Obs. do gestor:</b> {s.observacao_destino}
                </div>
              ) : null}
              {s.motivo_reprovacao ? (
                <div className="horas-muted" style={{ fontSize: 'var(--font-size-2xs)', marginTop: 3 }}>
                  <b>Reprovação:</b> {s.motivo_reprovacao}
                </div>
              ) : null}
              {s.motivo_alteracao ? (
                <div className="horas-muted" style={{ fontSize: 'var(--font-size-2xs)', marginTop: 3 }}>
                  <b>Alteração do DP:</b> {s.motivo_alteracao}
                </div>
              ) : null}
              {s.excecao_id ? (
                <div className="horas-muted" style={{ fontSize: 'var(--font-size-2xs)', marginTop: 3 }}>
                  Aberta por exceção de prazo (limite {fmtHora(s.limite_horario)})
                </div>
              ) : null}
            </td>
            {acoes ? (
              <td className="horas-right horas-td-acao" style={{ whiteSpace: 'nowrap' }}>
                {acoes(s)}
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
