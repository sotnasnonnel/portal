import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';

// Combobox pesquisável: um <select> que abre uma lista filtrável. Cai bem quando
// a lista de opções pode crescer (ex.: projetos). Controlado por value/onChange.
// A caixa de busca só aparece quando há muitas opções (searchThreshold).
//  - id: vai para o botão, para um <label htmlFor> apontar para ele.
// Teclado: seta abre e anda pela lista, Enter escolhe, Esc fecha e devolve o
// foco ao botão (sem fechar o diálogo em volta).
export default function SearchableSelect({
  value,
  onChange,
  options, // [{ value, label }]
  disabled = false,
  placeholder = 'Selecione…',
  searchThreshold = 6,
  id,
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const rootRef = useRef(null);
  const btnRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selected = options.find((o) => o.value === value) || null;
  const showSearch = options.length > searchThreshold;

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return options;
    return options.filter((o) => o.label.toLowerCase().includes(t));
  }, [q, options]);

  // O filtro zera sempre que a lista fecha (em vez de num efeito sobre `open`).
  const fechar = (devolverFoco = false) => {
    setOpen(false);
    setQ('');
    if (devolverFoco) btnRef.current?.focus();
  };

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setQ('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Ao abrir: foca a busca ou, sem ela, a opção escolhida (ou a primeira).
  useEffect(() => {
    if (!open) return;
    if (showSearch) {
      inputRef.current?.focus();
      return;
    }
    const opts = listRef.current?.querySelectorAll('.horas-ss-opt');
    if (!opts?.length) return;
    const atual = [...opts].find((o) => o.getAttribute('aria-selected') === 'true');
    (atual || opts[0]).focus();
  }, [open, showSearch]);

  const pick = (v) => {
    onChange(v);
    fechar(true);
  };

  const moverFoco = (delta) => {
    const opts = [...(listRef.current?.querySelectorAll('.horas-ss-opt') || [])];
    if (!opts.length) return;
    const i = opts.indexOf(document.activeElement);
    if (i === -1) {
      opts[delta > 0 ? 0 : opts.length - 1].focus();
      return;
    }
    const j = i + delta;
    if (j < 0) {
      (showSearch ? inputRef.current : opts[0])?.focus();
      return;
    }
    opts[Math.min(j, opts.length - 1)].focus();
  };

  const onKeyDown = (e) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      // preventDefault avisa o diálogo em volta (Modal) para não fechar junto.
      e.preventDefault();
      e.stopPropagation();
      fechar(true);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      moverFoco(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moverFoco(-1);
    } else if (e.key === 'Enter' && e.target === inputRef.current && filtered.length) {
      // Enter na busca escolhe o primeiro resultado.
      e.preventDefault();
      pick(filtered[0].value);
    }
  };

  // Tab para fora fecha a lista (relatedTarget nulo = clique, tratado acima).
  const onBlur = (e) => {
    if (open && e.relatedTarget && !rootRef.current?.contains(e.relatedTarget)) {
      setOpen(false);
      setQ('');
    }
  };

  return (
    <div
      className={`horas-ss${disabled ? ' is-disabled' : ''}`}
      ref={rootRef}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
    >
      <button
        ref={btnRef}
        id={id}
        type="button"
        className="horas-ss-btn"
        disabled={disabled}
        onClick={() => (open ? fechar() : setOpen(true))}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? '' : 'horas-ss-ph'}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={16} className="horas-ss-chev" aria-hidden="true" />
      </button>

      {open ? (
        <div className="horas-ss-pop">
          {showSearch ? (
            <div className="horas-ss-search">
              <Search size={14} aria-hidden="true" />
              <input
                ref={inputRef}
                type="text"
                value={q}
                placeholder="Pesquisar…"
                aria-label="Pesquisar na lista"
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          ) : null}
          <div className="horas-ss-list" role="listbox" ref={listRef}>
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
                {o.value === value ? <Check size={15} aria-hidden="true" /> : null}
              </button>
            ))}
            {filtered.length === 0 ? <div className="horas-ss-empty">Nada encontrado.</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
