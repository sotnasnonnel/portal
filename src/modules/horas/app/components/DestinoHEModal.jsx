import { useState } from 'react';
import { DESTINO_LABEL, PERIODO_LABEL, fmtMin, horaParaMin } from '../../lib/horasExtras';

// Define o DESTINO da hora extra: Medição/Pagamento ou Banco de Horas.
// Usado na aprovação do gestor e na alteração de destino pelo DP (que exige
// motivo — `pedeMotivo`). Banco de horas exige o previsto de compensação: data,
// período e quantidade. O gestor NÃO informa percentual: é do DP/RM, pela CCT.
export default function DestinoHEModal({
  solicitacao,
  titulo = 'Aprovar solicitação',
  pedeMotivo = false,
  onClose,
  onConfirm,
}) {
  const [destino, setDestino] = useState(solicitacao.destino || 'medicao');
  const [data, setData] = useState(solicitacao.compensacao_data || solicitacao.data_he || '');
  const [periodo, setPeriodo] = useState(solicitacao.compensacao_periodo || 'dia_inteiro');
  // Quantidade prevista em HH:MM, começando pelo total da hora extra.
  const [qtd, setQtd] = useState(fmtMin(solicitacao.compensacao_minutos ?? solicitacao.minutos));
  const [observacao, setObservacao] = useState(solicitacao.observacao_destino || '');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const ehBanco = destino === 'banco';

  async function confirmar() {
    const minutos = horaParaMin(qtd);
    if (pedeMotivo && !motivo.trim()) {
      setErro('Informe o motivo da alteração.');
      return;
    }
    if (ehBanco) {
      if (!data) {
        setErro('Informe a data prevista para compensação.');
        return;
      }
      if (!minutos) {
        setErro('Informe a quantidade prevista para compensação (ex.: 02:00).');
        return;
      }
    }
    setErro('');
    setSalvando(true);
    try {
      await onConfirm({
        destino,
        compensacao: ehBanco ? { data, periodo, minutos } : null,
        observacao,
        motivo: motivo.trim(),
      });
    } catch (e) {
      setErro(e?.message || 'Falha ao salvar.');
      setSalvando(false);
    }
  }

  return (
    <div className="horas-modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="horas-modal horas-modal-manual">
        <h3>
          {titulo} #{solicitacao.numero}
        </h3>
        <p className="horas-sub" style={{ marginTop: -6 }}>
          {solicitacao.colaborador_nome} · {fmtMin(solicitacao.minutos)} de hora extra
        </p>

        <div className="horas-fld">
          <label>Destino da hora</label>
          <select value={destino} onChange={(e) => setDestino(e.target.value)}>
            <option value="medicao">{DESTINO_LABEL.medicao}</option>
            <option value="banco">{DESTINO_LABEL.banco}</option>
          </select>
        </div>

        {ehBanco ? (
          <>
            <div className="horas-modal-row2">
              <div className="horas-fld">
                <label>Data prevista para compensação</label>
                <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
              </div>
              <div className="horas-fld">
                <label>Período previsto</label>
                <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
                  {Object.entries(PERIODO_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="horas-fld">
              <label>Quantidade prevista (HH:MM)</label>
              <input type="time" value={qtd} onChange={(e) => setQtd(e.target.value)} />
            </div>
          </>
        ) : null}

        {pedeMotivo ? (
          <div className="horas-fld">
            <label>Motivo da alteração</label>
            <textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
        ) : (
          <div className="horas-fld">
            <label>Observação (opcional)</label>
            <textarea rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
        )}

        <div className="horas-hint" style={{ marginBottom: 8 }}>
          O percentual da hora extra não é informado aqui — o DP/RM aplica conforme a CCT vigente.
        </div>

        {erro ? (
          <div className="horas-hint" style={{ marginBottom: 8 }}>
            ⚠️ {erro}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="horas-btn2" type="button" onClick={onClose} disabled={salvando}>
            Cancelar
          </button>
          <button className="horas-btn grn" type="button" onClick={confirmar} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
