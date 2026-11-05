import { useEffect, useState } from 'react';

/** Confirmação de ação. `onOk` é assíncrono; o erro fica por conta de quem chama. */
export default function Confirmar({
  titulo, texto, ok, perigo = false, onOk, onFechar,
}) {
  const [ocupado, setOcupado] = useState(false);

  // Na captura: Esc fecha só a confirmação, não o painel que está atrás dela.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onFechar();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onFechar]);

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
      <div className="frota-scrim alto" onClick={onFechar} />
      <div className="frota-modal" role="alertdialog" aria-modal="true" aria-labelledby="frota-modal-t">
        <h3 id="frota-modal-t">{titulo}</h3>
        <p>{texto}</p>
        <div className="frota-modal-a">
          <button type="button" className="frota-btn" onClick={onFechar}>Cancelar</button>
          <button type="button" className={`frota-btn ${perigo ? 'danger solid' : 'primary'}`} onClick={confirmar} disabled={ocupado}>
            {ocupado ? 'Processando…' : ok}
          </button>
        </div>
      </div>
    </>
  );
}
