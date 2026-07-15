import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';

// Combobox pesquisável self-contained (estilo .fin-ss). Controlado por value/onChange.
// A caixa de busca aparece quando há mais opções que searchThreshold.
export default function SearchSelect({
  value,
  onChange,
  options, // [{ value, label }]
  disabled = false,
  placeholder = 'Selecione…',
  searchThreshold = 6,
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const selected = options.find((o) => o.value === value) || null;
  const showSearch = options.length > searchThreshold;

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return options;
    return options.filter((o) => o.label.toLowerCase().includes(t));
  }, [q, options]);

  const fechar = () => setOpen(false);
  const alternar = () => setOpen((o) => { if (!o) setQ(''); return !o; });

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) fechar();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Só foca a busca ao abrir (efeito de DOM, sem setState).
  useEffect(() => {
    if (open && showSearch) inputRef.current?.focus();
  }, [open, showSearch]);

  const pick = (v) => { onChange(v); fechar(); };

  return (
    <div className={`fin-ss${disabled ? ' is-disabled' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="fin-ss-btn"
        disabled={disabled}
        onClick={alternar}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? '' : 'fin-ss-ph'}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={16} className="fin-ss-chev" />
      </button>

      {open ? (
        <div className="fin-ss-pop" role="listbox">
          {showSearch ? (
            <div className="fin-ss-search">
              <Search size={14} />
              <input
                ref={inputRef}
                type="text"
                value={q}
                placeholder="Pesquisar…"
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && fechar()}
              />
            </div>
          ) : null}
          <div className="fin-ss-list">
            {filtered.map((o) => (
              <button
                type="button"
                key={o.value}
                className={`fin-ss-opt${o.value === value ? ' is-sel' : ''}`}
                onClick={() => pick(o.value)}
                role="option"
                aria-selected={o.value === value}
              >
                <span>{o.label}</span>
                {o.value === value ? <Check size={15} /> : null}
              </button>
            ))}
            {filtered.length === 0 ? <div className="fin-ss-empty">Nada encontrado.</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
