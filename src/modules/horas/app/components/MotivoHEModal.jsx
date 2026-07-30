import { useState } from 'react';

// Pede um motivo obrigatório antes de uma ação irreversível (reprovar, cancelar).
// O motivo vai para a solicitação e, por trigger, para a auditoria.
export default function MotivoHEModal({ titulo, descricao, rotulo = 'Motivo', confirmar = 'Confirmar', perigo = false, onClose, onConfirm }) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function submit() {
    if (!motivo.trim()) {
      setErro(`${rotulo} é obrigatório.`);
      return;
    }
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
    <div className="horas-modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="horas-modal">
        <h3>{titulo}</h3>
        {descricao ? (
          <p className="horas-sub" style={{ marginTop: -6 }}>
            {descricao}
          </p>
        ) : null}
        <div className="horas-fld">
          <label>{rotulo}</label>
          <textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />
        </div>
        {erro ? (
          <div className="horas-hint" style={{ marginBottom: 8 }}>
            ⚠️ {erro}
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="horas-btn2" type="button" onClick={onClose} disabled={salvando}>
            Voltar
          </button>
          <button
            className={`horas-btn ${perigo ? 'red' : ''}`}
            type="button"
            onClick={submit}
            disabled={salvando}
          >
            {salvando ? 'Salvando…' : confirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
