import { useEffect, useId, useRef, useState } from 'react';

/**
 * Confirmação de ação. `onOk` é assíncrono; o erro fica por conta de quem chama.
 *
 * O foco abre em "Cancelar" (o lado seguro de uma ação destrutiva), Tab fica
 * preso entre os dois botões e, ao fechar, volta para o botão que abriu.
 */
export default function Confirmar({
  titulo, texto, ok, perigo = false, onOk, onFechar, cancelar = 'Cancelar',
}) {
  const [ocupado, setOcupado] = useState(false);
  const caixa = useRef(null);
  const btnCancelar = useRef(null);
  const voltarPara = useRef(typeof document !== 'undefined' ? document.activeElement : null);
  const idTitulo = useId();
  const idTexto = useId();

  // Na captura: Esc fecha só a confirmação, não o painel que está atrás dela.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (!ocupado) onFechar();
        return;
      }
      if (e.key !== 'Tab' || !caixa.current) return;
      const itens = [...caixa.current.querySelectorAll('button:not([disabled])')];
      if (!itens.length) { e.preventDefault(); return; }
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      const dentro = caixa.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === primeiro || !dentro)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && (document.activeElement === ultimo || !dentro)) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onFechar, ocupado]);

  useEffect(() => {
    btnCancelar.current?.focus();
    const origem = voltarPara.current;
    return () => {
      if (origem && typeof origem.focus === 'function' && document.contains(origem)) origem.focus();
    };
  }, []);

  const confirmar = async () => {
    setOcupado(true);
    try {
      await onOk();
    } finally {
      setOcupado(false);
    }
  };

  return (
    <>
      <div className="ti-scrim alto" onClick={ocupado ? undefined : onFechar} aria-hidden="true" />
      <div
        ref={caixa}
        className="ti-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={idTexto}
      >
        <h3 id={idTitulo}>{titulo}</h3>
        <p id={idTexto}>{texto}</p>
        <div className="ti-modal-a">
          <button ref={btnCancelar} type="button" className="ti-btn" onClick={onFechar} disabled={ocupado}>{cancelar}</button>
          <button type="button" className={`ti-btn ${perigo ? 'danger solid' : 'primary'}`} onClick={confirmar} disabled={ocupado} aria-busy={ocupado}>
            {ocupado ? 'Processando…' : ok}
          </button>
        </div>
      </div>
    </>
  );
}
