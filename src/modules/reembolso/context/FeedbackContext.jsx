import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import "./feedback.css";

// Provê toasts e diálogos de confirmação no estilo da app, substituindo os
// alert()/confirm() nativos do navegador. Use os hooks useToast() e useConfirm().
const ToastCtx = createContext(null);
const ConfirmCtx = createContext(null);

const TOAST_ICON = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

let nextToastId = 0;

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const resolverRef = useRef(null);

  const removeToast = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  // showToast(mensagem, tom?, duraçãoMs?) — tom: success | error | warning | info
  const showToast = useCallback(
    (message, tone = "success", duration = 3800) => {
      const id = ++nextToastId;
      setToasts((list) => [...list, { id, message, tone }]);
      if (duration > 0) setTimeout(() => removeToast(id), duration);
      return id;
    },
    [removeToast]
  );

  // confirm({ title, message, body, confirmLabel, cancelLabel, tone }) -> Promise<boolean>
  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialog(options);
    });
  }, []);

  const settle = useCallback((result) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setDialog(null);
    if (resolve) resolve(result);
  }, []);

  useEffect(() => {
    if (!dialog) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") settle(false);
      if (e.key === "Enter") settle(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, settle]);

  const toastValue = useMemo(() => ({ showToast }), [showToast]);
  const confirmValue = useMemo(() => ({ confirm }), [confirm]);

  const danger = dialog?.tone === "danger";

  return (
    <ToastCtx.Provider value={toastValue}>
      <ConfirmCtx.Provider value={confirmValue}>
        {children}

        <div className="toast-stack" role="status" aria-live="polite">
          {toasts.map((t) => {
            const Icon = TOAST_ICON[t.tone] ?? Info;
            return (
              <div key={t.id} className={`toast toast-${t.tone}`}>
                <Icon size={18} className="toast-icon" />
                <span className="toast-msg">{t.message}</span>
                <button
                  type="button"
                  className="toast-close"
                  onClick={() => removeToast(t.id)}
                  aria-label="Fechar"
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>

        {dialog && (
          <div className="modal-overlay" onClick={() => settle(false)}>
            <div
              className="modal-box"
              role="dialog"
              aria-modal="true"
              aria-labelledby={dialog.title ? "modal-title" : undefined}
              aria-describedby={dialog.message ? "modal-message" : undefined}
              onClick={(e) => e.stopPropagation()}
            >
              {dialog.title && <h3 className="modal-title" id="modal-title">{dialog.title}</h3>}
              {dialog.message && <p className="modal-message" id="modal-message">{dialog.message}</p>}
              {dialog.body && <div className="modal-body">{dialog.body}</div>}
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => settle(false)}>
                  {dialog.cancelLabel ?? "Cancelar"}
                </button>
                <button
                  type="button"
                  className={`btn ${danger ? "btn-danger-solid" : "btn-primary"}`}
                  onClick={() => settle(true)}
                  autoFocus
                >
                  {dialog.confirmLabel ?? "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast deve ser usado dentro de <FeedbackProvider>");
  return ctx.showToast;
}

export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error("useConfirm deve ser usado dentro de <FeedbackProvider>");
  return ctx.confirm;
}
