import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

const FOCAVEIS =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Moldura única dos diálogos da Gestão de Horas: papel de diálogo com título
// ligado (aria-labelledby), Esc fecha, o foco entra no diálogo, fica preso nele
// enquanto aberto e volta para onde estava ao fechar.
//  - onClose ausente (ex.: enquanto salva) = Esc e clique fora não fecham.
//  - fechar: mostra o X no canto (diálogos só de leitura, sem botão Cancelar).
export default function Modal({ titulo, onClose, className = '', style, fechar = false, children }) {
  const tituloId = useId();
  const ref = useRef(null);
  const fecharRef = useRef(onClose);
  useEffect(() => {
    fecharRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const anterior = document.activeElement;
    const caixa = ref.current;
    // Um campo com autoFocus já pegou o foco: respeita.
    if (caixa && !caixa.contains(document.activeElement)) {
      (caixa.querySelector(FOCAVEIS) || caixa).focus();
    }

    const onKey = (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        fecharRef.current?.();
        return;
      }
      if (e.key !== 'Tab' || !caixa) return;
      const els = [...caixa.querySelectorAll(FOCAVEIS)];
      if (!els.length) return;
      const primeiro = els[0];
      const ultimo = els[els.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (anterior instanceof HTMLElement) anterior.focus();
    };
  }, []);

  return (
    <div
      className="horas-modal-bg"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        ref={ref}
        className={`horas-modal${className ? ` ${className}` : ''}`}
        style={style}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
      >
        <div className="horas-modal-topo">
          <h3 id={tituloId}>{titulo}</h3>
          {fechar && onClose ? (
            <button className="horas-btn-icon" type="button" onClick={onClose} aria-label="Fechar">
              <X size={18} />
            </button>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}
