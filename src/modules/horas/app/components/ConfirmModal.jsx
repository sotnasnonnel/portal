import Modal from './Modal';

// Diálogo de confirmação no visual do módulo (substitui window.confirm/alert).
// O foco abre no Cancelar: num diálogo de exclusão, Enter por engano não apaga.
export default function ConfirmModal({
  open,
  title = 'Confirmar',
  message,
  confirmLabel = 'Excluir',
  cancelLabel = 'Cancelar',
  danger = true,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;
  return (
    <Modal titulo={title} onClose={onCancel} className="horas-modal-sm">
      <p className="horas-modal-msg">{message}</p>
      <div className="horas-modal-acoes">
        <button className="horas-btn2" type="button" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button className={`horas-btn ${danger ? 'red' : ''}`} type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
