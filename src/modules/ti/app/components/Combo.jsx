import {
  useEffect, useId, useMemo, useRef, useState,
} from 'react';
import { ChevronDown, X } from 'lucide-react';
import { norm } from '../../lib/regras';

/**
 * Lista suspensa com busca (combobox ARIA): digite parte do texto e a lista
 * filtra. Teclado: ↑/↓ escolhem, Enter confirma, Esc fecha.
 *
 * @param opcoes  strings ou {v, l}
 * @param vazio   rótulo da opção "nenhum" (valor ''); null tira a opção
 * @param livre   aceita valor fora da lista (ex.: e-mail fora do cadastro):
 *                aparece "Usar “texto”" e o Enter confirma o que foi digitado
 */
export default function Combo({
  id, valor = '', onChange, opcoes, vazio = '—', livre = false, placeholder = 'Digite para buscar',
  invalido = false, descricao,
}) {
  const lista = useMemo(() => opcoes.map((o) => (typeof o === 'string' ? { v: o, l: o } : o)), [opcoes]);
  const rotuloAtual = lista.find((o) => o.v === valor)?.l ?? valor ?? '';
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState(null); // null = não está digitando
  const [ativo, setAtivo] = useState(0);
  const caixa = useRef(null);
  const listaRef = useRef(null);
  const idLista = `${useId()}-lista`;

  const busca = texto ?? '';
  const filtradas = useMemo(() => {
    const q = norm(busca);
    const achadas = q ? lista.filter((o) => norm(o.l).includes(q) || norm(o.v).includes(q)) : lista;
    const itens = [];
    if (vazio != null && !q) itens.push({ v: '', l: vazio, vazio: true });
    itens.push(...achadas);
    const exato = lista.some((o) => norm(o.v) === q || norm(o.l) === q);
    if (livre && busca.trim() && !exato) itens.push({ v: busca.trim(), l: `Usar “${busca.trim()}”`, livre: true });
    return itens;
  }, [busca, lista, vazio, livre]);

  const fechar = () => { setAberto(false); setTexto(null); };
  // Sair do campo (Tab, clique fora) com texto digitado: na lista livre, o
  // texto vale (ex.: e-mail fora do cadastro); se casar com uma opção, ela.
  const sair = () => {
    const t = (texto ?? '').trim();
    if (t) {
      const igual = lista.find((o) => norm(o.l) === norm(t) || norm(o.v) === norm(t));
      if (igual) onChange(igual.v);
      else if (livre) onChange(t);
    }
    fechar();
  };
  const sairRef = useRef(sair);
  useEffect(() => { sairRef.current = sair; });
  const escolher = (o) => { onChange(o.v); fechar(); };

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => { if (!caixa.current?.contains(e.target)) sairRef.current(); };
    document.addEventListener('pointerdown', fora);
    return () => document.removeEventListener('pointerdown', fora);
  }, [aberto]);

  // Mantém o item ativo visível ao navegar pelo teclado.
  useEffect(() => {
    if (!aberto) return;
    listaRef.current?.querySelector(`[data-i="${ativo}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [ativo, aberto]);

  const tecla = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!aberto) { setAberto(true); return; }
      const passo = e.key === 'ArrowDown' ? 1 : -1;
      setAtivo((i) => Math.max(0, Math.min(filtradas.length - 1, i + passo)));
    } else if (e.key === 'Enter') {
      if (!aberto) return;
      e.preventDefault();
      const o = filtradas[ativo];
      if (o) escolher(o);
    } else if (e.key === 'Escape') {
      if (aberto) { e.preventDefault(); e.stopPropagation(); fechar(); }
    } else if (e.key === 'Tab') {
      sair();
    }
  };

  return (
    <div className={`ti-combo ${aberto ? 'aberto' : ''}`} ref={caixa}>
      <input
        id={id}
        className="ti-inp"
        role="combobox"
        aria-expanded={aberto}
        aria-controls={idLista}
        aria-autocomplete="list"
        aria-activedescendant={aberto && filtradas[ativo] ? `${idLista}-${ativo}` : undefined}
        aria-invalid={invalido || undefined}
        aria-describedby={descricao}
        autoComplete="off"
        placeholder={valor ? undefined : (vazio && vazio !== '—' ? vazio : placeholder)}
        value={texto ?? (valor ? rotuloAtual : '')}
        onFocus={(e) => { e.target.select(); }}
        onClick={() => setAberto(true)}
        onChange={(e) => { setTexto(e.target.value); setAtivo(0); setAberto(true); }}
        onKeyDown={tecla}
      />
      {valor && vazio != null ? (
        <button type="button" className="ti-combo-x" aria-label="Limpar" tabIndex={-1} onClick={() => { onChange(''); fechar(); }}>
          <X size={14} aria-hidden="true" />
        </button>
      ) : (
        <ChevronDown className="ti-combo-seta" size={15} aria-hidden="true" />
      )}
      {aberto && (
        <ul className="ti-combo-lista" role="listbox" id={idLista} ref={listaRef}>
          {filtradas.length ? filtradas.map((o, i) => (
            <li
              key={`${o.livre ? 'livre' : 'o'}-${o.v}`}
              id={`${idLista}-${i}`}
              data-i={i}
              role="option"
              aria-selected={o.v === valor}
              className={`${i === ativo ? 'ativo' : ''} ${o.vazio || o.livre ? 'extra' : ''}`.trim()}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => escolher(o)}
              onMouseEnter={() => setAtivo(i)}
            >
              {o.l}
            </li>
          )) : <li className="nada" role="presentation">Nada encontrado</li>}
        </ul>
      )}
    </div>
  );
}
