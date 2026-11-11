import { useId, useState } from 'react';
import Modal from './Modal';
import Aviso from './Aviso';

// Pede um motivo obrigatório antes de uma ação irreversível (reprovar, cancelar).
// O motivo vai para a solicitação e, por trigger, para a auditoria.
export default function MotivoHEModal({ titulo, descricao, rotulo = 'Motivo', confirmar = 'Confirmar', perigo = false, onClose, onConfirm }) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const uid = useId();

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
    <Modal titulo={titulo} onClose={salvando ? undefined : onClose}>
      {descricao ? <p className="horas-modal-msg">{descricao}</p> : null}
      <div className="horas-fld">
        <label htmlFor={`${uid}-motivo`}>{rotulo}</label>
        <textarea
          id={`${uid}-motivo`}
          rows={3}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          aria-invalid={erro ? true : undefined}
          autoFocus
        />
      </div>
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      <div className="horas-modal-acoes">
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
    </Modal>
  );
}
