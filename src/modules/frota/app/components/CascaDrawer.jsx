import { useEffect } from 'react';
import { X } from 'lucide-react';

/** Casca do painel lateral. Esc, o X e o fundo fecham por `onFechar`. */
export default function CascaDrawer({
  cabecalho, rodape, onFechar, children,
}) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFechar]);

  return (
    <>
      <div className="frota-scrim" onClick={onFechar} />
      <aside className="frota-drawer" role="dialog" aria-modal="true" aria-label="Detalhe">
        <div className="frota-dr-h">
          <div className="frota-dr-t">{cabecalho}</div>
          <button type="button" className="frota-ibtn" onClick={onFechar} aria-label="Fechar"><X size={16} /></button>
        </div>
        <div className="frota-dr-b">{children}</div>
        <div className="frota-dr-f">{rodape}</div>
      </aside>
    </>
  );
}
