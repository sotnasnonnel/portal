import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import { filtrarOpcoes } from './searchFilter';
import './SearchSelect.css';

// Combobox pesquisável reutilizável, estilizado com o design system do portal
// (não confundir com o SearchableSelect do módulo Horas, que usa o CSS do Horas).
// Controlado por value/onChange. A caixa de busca aparece só quando há mais
// opções que searchThreshold — some quando a lista é curta.
export default function SearchSelect({
  value,
  onChange,
  options, // [{ value, label }]
  disabled = false,
  placeholder = 'Selecione…',
  searchThreshold = 6,
  ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const selected = options.find((o) => o.value === value) || null;
  const showSearch = options.length > searchThreshold;

  const filtered = useMemo(() => filtrarOpcoes(options, q), [q, options]);

  const close = () => {
    setOpen(false);
    setQ(''); // limpa o filtro ao fechar
  };

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) close();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Foca a busca ao abrir.
  useEffect(() => {
    if (open && showSearch) inputRef.current?.focus();
  }, [open, showSearch]);

  const pick = (v) => {
    onChange(v);
    close();
  };

  return (
    <div className={`ss2${disabled ? ' is-disabled' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="ss2-btn"
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className={selected ? '' : 'ss2-ph'}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={16} className="ss2-chev" />
      </button>

      {open ? (
        <div className="ss2-pop" role="listbox">
          {showSearch ? (
            <div className="ss2-search">
              <Search size={14} />
              <input
                ref={inputRef}
                type="text"
                value={q}
                placeholder="Pesquisar…"
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && close()}
              />
            </div>
          ) : null}
          <div className="ss2-list">
            {filtered.map((o) => (
              <button
                type="button"
                key={o.value}
                className={`ss2-opt${o.value === value ? ' is-sel' : ''}`}
                onClick={() => pick(o.value)}
                role="option"
                aria-selected={o.value === value}
              >
                <span>{o.label}</span>
                {o.value === value ? <Check size={15} /> : null}
              </button>
            ))}
            {filtered.length === 0 ? <div className="ss2-empty">Nada encontrado.</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
