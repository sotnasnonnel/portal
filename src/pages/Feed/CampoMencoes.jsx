import { useEffect, useRef, useState } from 'react';
import { AtSign, Megaphone } from 'lucide-react';
import {
  buscaMencao, filtrarPessoas, MENCAO_TODOS, nomeMencao, partesDestaque,
} from '../../config/feed';
import { diretorioDoFeed } from '../../services/feed';
import { cargo, iniciais } from '../../utils/pessoas';
import { posicaoCursor } from './posicaoCursor';

/**
 * Textarea do feed com marcação. Ao digitar "@", abre na hora a lista de
 * pessoas — o diretório vem uma vez (diretorioDoFeed) e é filtrado aqui, sem
 * ida ao banco a cada letra. Quem pode (RH/admin) vê "@todos" em primeiro.
 * Ao escolher, troca o "@termo" por "@Nome Sobrenome " e guarda { id, nome }.
 * Setas escolhem, Enter/Tab confirmam, Esc fecha só a lista.
 *
 * A lista abre colada no "@" (posicaoCursor): logo abaixo da linha dele, ou
 * logo acima quando falta espaço embaixo na tela (caixa de comentário no pé
 * do post), sem passar das bordas do campo.
 *
 * `inputRef` dá acesso ao textarea (o modal usa para pôr emoji no cursor).
 * `onKeyDown` de fora só roda com a lista fechada.
 */
export default function CampoMencoes({
  value, onChange, mencoes, onMencoes, inputRef, onKeyDown, className = '', ...rest
}) {
  const refInterno = useRef(null);
  const ref = inputRef || refInterno;
  const [dir, setDir] = useState(null);       // { pessoas, podeTodos }
  const [busca, setBusca] = useState(null);   // { inicio, termo } | null
  const [ativo, setAtivo] = useState(0);
  const [lugar, setLugar] = useState(null); // estilo de posição da lista

  // Já baixa o diretório quando o campo aparece: no primeiro "@" ele está pronto.
  useEffect(() => {
    let vivo = true;
    diretorioDoFeed().then((d) => { if (vivo) setDir(d); }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  const termo = busca?.termo ?? '';
  const mostraTodos = !!dir?.podeTodos && 'todos'.startsWith(termo.toLowerCase())
    && !mencoes.some((m) => m.id === MENCAO_TODOS.id);
  const opcoes = busca && dir
    ? [...(mostraTodos ? [MENCAO_TODOS] : []), ...filtrarPessoas(dir.pessoas, termo, mostraTodos ? 7 : 8)]
    : [];
  const aberta = !!busca && opcoes.length > 0;

  // Coloca a lista junto do "@": abaixo da linha dele, ou acima se a tela
  // acabar; na horizontal, alinhada ao "@" sem sair do campo.
  const posicionar = (inicio) => {
    const el = ref.current;
    const pos = posicaoCursor(el, inicio);
    if (!el || !pos) { setLugar(null); return; }
    const largura = Math.min(340, el.clientWidth);
    const left = Math.max(0, Math.min(pos.left, el.offsetWidth - largura));
    const naTela = el.getBoundingClientRect().top + pos.top + pos.altura;
    const cima = window.innerHeight - naTela < 330 && naTela > 330;
    setLugar(cima
      ? { left, bottom: el.offsetHeight - pos.top + 4, width: largura, cima: true }
      : { left, top: pos.top + pos.altura + 4, width: largura, cima: false });
  };

  const atualizarBusca = (texto, cursor) => {
    const b = buscaMencao(texto, cursor);
    if (b && b.inicio !== busca?.inicio) posicionar(b.inicio);
    if (b?.termo !== busca?.termo) setAtivo(0);
    setBusca(b);
  };

  const escolher = (p) => {
    const nome = p.id === MENCAO_TODOS.id ? MENCAO_TODOS.nome : nomeMencao(p.nome);
    const cursor = ref.current?.selectionStart ?? value.length;
    onChange(`${value.slice(0, busca.inicio)}@${nome} ${value.slice(cursor)}`);
    if (!mencoes.some((m) => m.id === p.id)) onMencoes([...mencoes, { id: p.id, nome }]);
    const pos = busca.inicio + nome.length + 2;
    setBusca(null);
    requestAnimationFrame(() => { ref.current?.focus(); ref.current?.setSelectionRange(pos, pos); });
  };

  const teclar = (e) => {
    if (aberta) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo((i) => (i + 1) % opcoes.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo((i) => (i - 1 + opcoes.length) % opcoes.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); escolher(opcoes[Math.min(ativo, opcoes.length - 1)]); return; }
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation(); e.nativeEvent.stopImmediatePropagation();
        setBusca(null); return;
      }
    }
    onKeyDown?.(e);
  };

  return (
    <span className={`feed-mencoes-campo ${className}`}>
      <textarea
        {...rest}
        ref={ref}
        value={value}
        onChange={(e) => { onChange(e.target.value); atualizarBusca(e.target.value, e.target.selectionStart); }}
        onKeyDown={teclar}
        onClick={(e) => atualizarBusca(e.target.value, e.target.selectionStart)}
        onBlur={() => setTimeout(() => setBusca(null), 150)}
        aria-autocomplete="list"
        aria-expanded={aberta}
      />
      {aberta && (
        <div className={`feed-mencoes-lista ${lugar?.cima ? 'para-cima' : ''}`}
          style={lugar ? { left: lugar.left, top: lugar.top ?? 'auto', bottom: lugar.bottom ?? 'auto', width: lugar.width } : undefined}>
          <div className="feed-mencoes-cab"><AtSign size={13} /> Marcar pessoa</div>
          <ul role="listbox" aria-label="Marcar pessoa">
            {opcoes.map((p, i) => {
              const todos = p.id === MENCAO_TODOS.id;
              const nome = todos ? 'todos' : nomeMencao(p.nome);
              const [a, b, c] = partesDestaque(nome, termo);
              return (
                <li key={p.id} role="option" aria-selected={i === ativo}>
                  <button type="button" className={`${i === ativo ? 'is-ativo' : ''} ${todos ? 'is-todos' : ''}`}
                    onMouseDown={(e) => { e.preventDefault(); escolher(p); }} onMouseEnter={() => setAtivo(i)}>
                    <span className="feed-mencoes-av" aria-hidden="true">
                      {todos ? <Megaphone size={15} /> : iniciais(p.nome)}
                    </span>
                    <span className="feed-mencoes-txt">
                      <b>{a}<mark>{b}</mark>{c}</b>
                      <small>{todos ? 'Avisa todo mundo da PHD' : (p.funcao ? cargo(p.funcao) : ' ')}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="feed-mencoes-dica">↑↓ para escolher · Enter para marcar · Esc para fechar</div>
        </div>
      )}
    </span>
  );
}
