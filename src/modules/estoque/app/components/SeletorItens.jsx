import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Check } from 'lucide-react';
import { filtrarPosicao, rotuloVariante, detalheVariante } from '../../lib/catalogo';

/**
 * Escolha de uma variante do catálogo, com busca e o SALDO ao lado de cada
 * opção — é o saldo que decide a escolha de quem está separando o material.
 *
 * Não usa o SearchSelect genérico do portal (components/UI/SearchSelect.jsx)
 * porque aqui cada opção tem duas linhas e um número à direita, e o termo casa
 * contra descrição + tamanho + CA ao mesmo tempo ("botina 42", "45021").
 *
 * Props:
 *  - posicao: linhas de estoque_posicao já carregadas
 *  - categoria: 'epi' | 'uniforme' | '' (sem filtro)
 *  - onEscolher(variante)
 *  - escolhida: a variante já selecionada (para mostrar o rótulo)
 *  - id, placeholder, autoFocus
 */
export default function SeletorItens({
  posicao, categoria = '', onEscolher, escolhida = null,
  id, placeholder = 'Buscar item por nome, tamanho ou CA…', autoFocus = false,
}) {
  const [termo, setTermo] = useState('');
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const caixa = useRef(null);

  const opcoes = useMemo(
    () => filtrarPosicao(posicao, { termo, categoria }).slice(0, 60),
    [posicao, termo, categoria],
  );

  // Clique fora fecha. Sem isto a lista fica pendurada sobre a tela ao rolar.
  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => { if (!caixa.current?.contains(e.target)) setAberto(false); };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);

  // A opção destacada é derivada, não sincronizada por efeito: a lista encolhe
  // a cada tecla e um índice guardado ficaria fora do intervalo.
  const ativoSeguro = Math.min(ativo, Math.max(0, opcoes.length - 1));

  const escolher = (v) => {
    onEscolher?.(v);
    setTermo('');
    setAberto(false);
  };

  const teclado = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault(); setAberto(true);
      setAtivo((i) => Math.min(i + 1, opcoes.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); setAtivo((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && aberto && opcoes[ativoSeguro]) {
      e.preventDefault(); escolher(opcoes[ativoSeguro]);
    } else if (e.key === 'Escape') {
      setAberto(false);
    }
  };

  return (
    <div className="est-seletor" ref={caixa}>
      <div className="est-busca">
        <Search size={16} />
        <input
          id={id}
          className="est-input"
          autoFocus={autoFocus}
          value={aberto ? termo : (escolhida ? rotuloVariante(escolhida) : termo)}
          placeholder={placeholder}
          onChange={(e) => { setTermo(e.target.value); setAtivo(0); setAberto(true); }}
          onFocus={() => { setTermo(''); setAtivo(0); setAberto(true); }}
          onKeyDown={teclado}
          role="combobox"
          aria-expanded={aberto}
          aria-autocomplete="list"
        />
      </div>

      {aberto && (
        <div className="est-seletor-lista" role="listbox">
          {opcoes.length === 0 ? (
            <div className="est-seletor-op" aria-disabled="true">
              <span className="est-seletor-op-txt">
                <strong>Nenhum item encontrado</strong>
                <small>
                  {termo
                    ? 'Confira a busca ou cadastre o item na Posição de estoque.'
                    : 'O catálogo ainda está vazio.'}
                </small>
              </span>
            </div>
          ) : opcoes.map((v, i) => (
            <button
              key={v.id}
              type="button"
              role="option"
              aria-selected={escolhida?.id === v.id}
              className={`est-seletor-op ${i === ativoSeguro ? 'is-ativo' : ''}`}
              onMouseEnter={() => setAtivo(i)}
              onClick={() => escolher(v)}
            >
              <span className="est-seletor-op-txt">
                <strong>{v.descricao}</strong>
                <small>{detalheVariante(v) || 'Sem variação'}</small>
              </span>
              {escolhida?.id === v.id && <Check size={14} />}
              <span className={`est-seletor-op-saldo ${v.saldo === 0 ? 'is-critico' : ''}`}>
                {v.saldo} {v.unidade || 'un'}
                {v.saldo_usado > 0 && <small> ({v.saldo_usado} usada)</small>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
