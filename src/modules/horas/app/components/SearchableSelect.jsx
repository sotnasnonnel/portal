import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';

// Combobox pesquisável: um <select> que abre uma lista filtrável. Cai bem quando
// a lista de opções pode crescer (ex.: projetos). Controlado por value/onChange.
// A caixa de busca só aparece quando há muitas opções (searchThreshold).
export default function SearchableSelect({
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

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Foca a busca ao abrir; limpa o filtro ao fechar.
  useEffect(() => {
    if (open && showSearch) inputRef.current?.focus();
    if (!open) setQ('');
  }, [open, showSearch]);

  const pick = (v) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div className={`horas-ss${disabled ? ' is-disabled' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="horas-ss-btn"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? '' : 'horas-ss-ph'}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={16} className="horas-ss-chev" />
      </button>

      {open ? (
        <div className="horas-ss-pop" role="listbox">
          {showSearch ? (
            <div className="horas-ss-search">
              <Search size={14} />
              <input
                ref={inputRef}
                type="text"
                value={q}
                placeholder="Pesquisar…"
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
              />
            </div>
          ) : null}
          <div className="horas-ss-list">
            {filtered.map((o) => (
              <button
                type="button"
                key={o.value}
                className={`horas-ss-opt${o.value === value ? ' is-sel' : ''}`}
                onClick={() => pick(o.value)}
                role="option"
                aria-selected={o.value === value}
              >
                <span>{o.label}</span>
                {o.value === value ? <Check size={15} /> : null}
              </button>
            ))}
            {filtered.length === 0 ? <div className="horas-ss-empty">Nada encontrado.</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
