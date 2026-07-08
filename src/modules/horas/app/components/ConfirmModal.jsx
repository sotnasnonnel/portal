// Diálogo de confirmação no visual do módulo (substitui window.confirm/alert).
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
    <div className="horas-modal-bg" onClick={(e) => e.target === e.currentTarget && onCancel?.()}>
      <div className="horas-modal" style={{ width: 420 }}>
        <h3>{title}</h3>
        <p className="horas-sub" style={{ marginBottom: 20 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="horas-btn2" type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className={`horas-btn ${danger ? 'red' : ''}`} type="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
