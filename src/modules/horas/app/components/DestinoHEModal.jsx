import { useId, useState } from 'react';
import Modal from './Modal';
import Aviso from './Aviso';
import {
  DESTINO_LABEL,
  PERIODO_LABEL,
  PRAZO_COMPENSACAO_DIAS,
  fmtMin,
  horaParaMin,
  janelaCompensacao,
  validarCompensacao,
} from '../../../../config/horasExtras';

// Define o DESTINO da hora extra: Medição/Pagamento ou Banco de Horas.
// Usado na aprovação do gestor e na alteração de destino pelo DP (que exige
// motivo — `pedeMotivo`). Banco de horas exige o previsto de compensação: data,
// período e quantidade, e a data precisa cair na janela de PRAZO_COMPENSACAO_DIAS
// contada da hora extra (o input já nasce limitado por min/max; a mesma regra é
// revalidada aqui e virou constraint no banco).
// O gestor NÃO informa percentual: é do DP/RM, pela CCT.
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
  const uid = useId();

  const ehBanco = destino === 'banco';
  // Janela legal da compensação: da data da hora extra até 180 dias depois.
  const janela = janelaCompensacao(solicitacao.data_he);
  const prazo = validarCompensacao({ dataHe: solicitacao.data_he, dataCompensacao: data });

  async function confirmar() {
    const minutos = horaParaMin(qtd);
    if (pedeMotivo && !motivo.trim()) {
      setErro('Informe o motivo da alteração.');
      return;
    }
    if (ehBanco) {
      if (!prazo.ok) {
        setErro(prazo.msg);
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
    <Modal
      titulo={`${titulo} #${solicitacao.numero}`}
      onClose={salvando ? undefined : onClose}
      className="horas-modal-manual"
    >
      <p className="horas-modal-msg">
        {solicitacao.colaborador_nome} · {fmtMin(solicitacao.minutos)} de hora extra
      </p>

      <div className="horas-fld">
        <label htmlFor={`${uid}-destino`}>Destino da hora</label>
        <select id={`${uid}-destino`} value={destino} onChange={(e) => setDestino(e.target.value)}>
          <option value="medicao">{DESTINO_LABEL.medicao}</option>
          <option value="banco">{DESTINO_LABEL.banco}</option>
        </select>
      </div>

      {ehBanco ? (
        <>
          <div className="horas-modal-row2">
            <div className="horas-fld">
              <label htmlFor={`${uid}-data`}>
                Data prevista para compensação (até {PRAZO_COMPENSACAO_DIAS} dias)
              </label>
              <input
                id={`${uid}-data`}
                type="date"
                value={data}
                min={janela.min}
                max={janela.max}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
            <div className="horas-fld">
              <label htmlFor={`${uid}-periodo`}>Período previsto</label>
              <select id={`${uid}-periodo`} value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
                {Object.entries(PERIODO_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="horas-fld">
            <label htmlFor={`${uid}-qtd`}>Quantidade prevista (HH:MM)</label>
            <input id={`${uid}-qtd`} type="time" value={qtd} onChange={(e) => setQtd(e.target.value)} />
          </div>
          <Aviso tom={prazo.ok ? 'ok' : 'erro'}>{prazo.msg}</Aviso>
        </>
      ) : null}

      {pedeMotivo ? (
        <div className="horas-fld">
          <label htmlFor={`${uid}-motivo`}>Motivo da alteração</label>
          <textarea id={`${uid}-motivo`} rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
      ) : (
        <div className="horas-fld">
          <label htmlFor={`${uid}-obs`}>
            Observação <span className="horas-muted">(opcional)</span>
          </label>
          <textarea id={`${uid}-obs`} rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </div>
      )}

      <Aviso>O percentual da hora extra não é informado aqui — o DP/RM aplica conforme a CCT vigente.</Aviso>

      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      <div className="horas-modal-acoes">
        <button className="horas-btn2" type="button" onClick={onClose} disabled={salvando}>
          Cancelar
        </button>
        <button
          className="horas-btn grn"
          type="button"
          onClick={confirmar}
          disabled={salvando || (ehBanco && !prazo.ok)}
        >
          {salvando ? 'Salvando…' : 'Confirmar'}
        </button>
      </div>
    </Modal>
  );
}
