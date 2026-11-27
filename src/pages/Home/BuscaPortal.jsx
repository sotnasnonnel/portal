import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ExternalLink, CornerDownLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { buscarNoIndice } from '../../config/buscaPortal';
import { montarIndiceBusca } from './indiceBusca';
import './BuscaPortal.css';

const ROTULO_TIPO = { modulo: 'Módulo', tela: 'Tela', chamado: 'Abrir chamado', externo: 'Link externo' };

/**
 * "Buscar no portal": a caixa da Home que acha qualquer tela, chamado ou
 * ferramenta pelo nome, sem a pessoa precisar saber em qual card ela mora.
 *
 * Só lista o que a pessoa pode abrir (ver indiceBusca.js). Teclado: "/" ou
 * Ctrl+K foca; setas andam; Enter abre; Esc limpa.
 *
 * onAcao: para os itens que abrem um popup da Home em vez de navegar
 * (hoje, "Soluções Integradas").
 */
export default function BuscaPortal({ onAcao }) {
  const { user, modules } = useAuth();
  const navigate = useNavigate();
  const [texto, setTexto] = useState('');
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const input = useRef(null);
  const caixa = useRef(null);
  const idLista = useId();

  const indice = useMemo(() => montarIndiceBusca({ user, modules }), [user, modules]);
  const resultados = useMemo(() => buscarNoIndice(indice, texto), [indice, texto]);
  const temTexto = texto.trim().length > 0;
  const mostraLista = aberto && temTexto;

  // Atalho global: "/" (fora de campo de texto) ou Ctrl/⌘+K.
  useEffect(() => {
    const onKey = (e) => {
      const alvo = e.target;
      const digitando = alvo instanceof HTMLElement
        && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName));
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !digitando)) {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Clique fora fecha a lista (o texto fica, para a pessoa voltar a ele).
  useEffect(() => {
    if (!mostraLista) return undefined;
    const onDown = (e) => { if (!caixa.current?.contains(e.target)) setAberto(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [mostraLista]);

  const abrir = (r) => {
    if (!r) return;
    setAberto(false);
    if (r.url) {
      window.open(r.url, '_blank', 'noopener,noreferrer');
    } else if (r.acao) {
      onAcao?.(r.acao);
    } else {
      navigate(r.href);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAberto(true);
      setAtivo((i) => (resultados.length ? (i + 1) % resultados.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAtivo((i) => (resultados.length ? (i - 1 + resultados.length) % resultados.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      abrir(resultados[ativo]);
    } else if (e.key === 'Escape') {
      if (texto) setTexto(''); else input.current?.blur();
    }
  };

  const idItem = (i) => `${idLista}-${i}`;

  return (
    <div className="hbusca" ref={caixa}>
      <div className="hbusca-campo" role="search">
        <Search size={18} className="hbusca-lupa" aria-hidden="true" />
        <input
          ref={input}
          type="search"
          className="hbusca-input"
          placeholder="Buscar no portal: telas, chamados, ferramentas…"
          value={texto}
          onChange={(e) => { setTexto(e.target.value); setAtivo(0); setAberto(true); }}
          onFocus={() => setAberto(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-label="Buscar no portal"
          aria-expanded={mostraLista}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={mostraLista && resultados[ativo] ? idItem(ativo) : undefined}
          autoComplete="off"
          spellCheck={false}
        />
        {texto ? (
          <button
            type="button"
            className="hbusca-limpa"
            onClick={() => { setTexto(''); input.current?.focus(); }}
            aria-label="Limpar busca"
            title="Limpar busca"
          >
            <X size={16} />
          </button>
        ) : (
          <kbd className="hbusca-atalho" aria-hidden="true" title="Atalho: / ou Ctrl+K">/</kbd>
        )}
      </div>

      {mostraLista && (
        <div className="hbusca-pop">
          {resultados.length > 0 ? (
            <ul className="hbusca-lista" id={idLista} role="listbox" aria-label="Resultados da busca">
              {resultados.map((r, i) => {
                const Icon = r.Icon;
                return (
                  <li
                    key={r.href || r.url}
                    id={idItem(i)}
                    role="option"
                    aria-selected={i === ativo}
                    className={`hbusca-item${i === ativo ? ' is-ativo' : ''}`}
                    onMouseEnter={() => setAtivo(i)}
                    // mousedown, e não click: abre antes do blur do campo.
                    onMouseDown={(e) => { e.preventDefault(); abrir(r); }}
                  >
                    <span className={`hbusca-ico tipo-${r.tipo}`}><Icon size={17} /></span>
                    <span className="hbusca-txt">
                      <strong>{r.titulo}</strong>
                      <small>{r.onde}</small>
                    </span>
                    <span className="hbusca-tipo">
                      {r.url ? <ExternalLink size={13} aria-hidden="true" /> : null}
                      {ROTULO_TIPO[r.tipo]}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="hbusca-vazio" role="status">
              Nada encontrado para “{texto.trim()}”. Tente outra palavra.
            </p>
          )}
          {resultados.length > 0 && (
            <p className="hbusca-dica" aria-hidden="true">
              <span><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
              <span><kbd><CornerDownLeft size={11} /></kbd> abrir</span>
              <span><kbd>Esc</kbd> limpar</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
