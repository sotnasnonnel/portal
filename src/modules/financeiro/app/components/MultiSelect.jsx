import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';

// Multi-seleção pesquisável (estilo .fin-ss, mesmo do SearchSelect).
// `value` é um array de strings; `onChange` recebe o novo array.
export default function MultiSelect({
  value = [],
  onChange,
  options, // string[]
  disabled = false,
  placeholder = 'Selecione…',
  searchThreshold = 6,
  // Fecha a lista ao MARCAR uma opção. Desmarcar mantém aberto — tirar várias
  // seguidas é o caso em que a lista aberta ajuda.
  fecharAoSelecionar = false,
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const showSearch = options.length > searchThreshold;
  const selecionados = Array.isArray(value) ? value : [];

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return options;
    return options.filter((o) => o.toLowerCase().includes(t));
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

  useEffect(() => {
    if (open && showSearch) inputRef.current?.focus();
  }, [open, showSearch]);

  // Por padrão não fecha ao escolher: multi-seleção costuma encadear cliques.
  // Com `fecharAoSelecionar`, marcar fecha (e a lista reabre pelo botão).
  const alternarItem = (opt) => {
    const jaEstava = selecionados.includes(opt);
    onChange(jaEstava
      ? selecionados.filter((v) => v !== opt)
      : [...selecionados, opt]);
    if (!jaEstava && fecharAoSelecionar) fechar();
  };

  const remover = (opt, e) => {
    e.stopPropagation();
    onChange(selecionados.filter((v) => v !== opt));
  };

  return (
    <div className={`fin-ss${disabled ? ' is-disabled' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="fin-ss-btn fin-ms-btn"
        disabled={disabled}
        onClick={alternar}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selecionados.length === 0 ? (
          <span className="fin-ss-ph">{placeholder}</span>
        ) : (
          <span className="fin-ms-chips">
            {selecionados.map((s) => (
              <span key={s} className="fin-ms-chip">
                {s}
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`Remover ${s}`}
                  onClick={(e) => remover(s, e)}
                  className="fin-ms-chip-x"
                >
                  <X size={11} />
                </span>
              </span>
            ))}
          </span>
        )}
        <ChevronDown size={16} className="fin-ss-chev" />
      </button>

      {open ? (
        <div className="fin-ss-pop" role="listbox" aria-multiselectable="true">
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
            {filtered.map((o) => {
              const sel = selecionados.includes(o);
              return (
                <button
                  type="button"
                  key={o}
                  className={`fin-ss-opt${sel ? ' is-sel' : ''}`}
                  onClick={() => alternarItem(o)}
                  role="option"
                  aria-selected={sel}
                >
                  <span>{o}</span>
                  {sel ? <Check size={15} /> : null}
                </button>
              );
            })}
            {filtered.length === 0 ? <div className="fin-ss-empty">Nada encontrado.</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
