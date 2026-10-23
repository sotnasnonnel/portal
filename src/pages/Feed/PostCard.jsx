import { useCallback, useRef, useState } from 'react';
import {
  AtSign, Heart, MessageCircle, MoreHorizontal, Pin, PinOff, Pencil, Trash2, Flag, EyeOff, Eye, X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { MENCAO_TODOS, plural, tempoRelativo, TEXTO_MAX } from '../../config/feed';
import { usePontos } from '../../contexts/PontosContext';
import * as api from '../../services/feed';
import Autor from './Autor';
import Comentarios from './Comentarios';
import TextoComLinks from './TextoComLinks';

/** Foto em tela cheia, com setas entre as fotos do post. */
function Visualizador({ fotos, inicio, onFechar }) {
  const [i, setI] = useState(inicio);
  const ir = (d) => setI((v) => (v + d + fotos.length) % fotos.length);
  return (
    <div className="feed-lightbox" role="dialog" aria-modal="true" aria-label="Foto do post" onClick={onFechar}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onFechar();
        if (e.key === 'ArrowLeft') ir(-1);
        if (e.key === 'ArrowRight') ir(1);
      }} tabIndex={-1} ref={(el) => el?.focus()}>
      <button type="button" className="feed-lightbox-fechar" aria-label="Fechar" onClick={onFechar}><X size={22} /></button>
      {fotos.length > 1 && (
        <button type="button" className="feed-lightbox-seta is-esq" aria-label="Foto anterior"
          onClick={(e) => { e.stopPropagation(); ir(-1); }}><ChevronLeft size={28} /></button>
      )}
      <img src={fotos[i]} alt="" onClick={(e) => e.stopPropagation()} />
      {fotos.length > 1 && (
        <button type="button" className="feed-lightbox-seta is-dir" aria-label="Próxima foto"
          onClick={(e) => { e.stopPropagation(); ir(1); }}><ChevronRight size={28} /></button>
      )}
      {fotos.length > 1 && <span className="feed-lightbox-conta">{i + 1}/{fotos.length}</span>}
    </div>
  );
}

// Texto acima disso aparece cortado em 6 linhas, com "ver mais" (como no selink).
const TEXTO_LONGO = 320;

/**
 * Mais de uma foto: uma por vez, com setas e o contador "2/5". O trilho rola
 * com scroll-snap, então no celular arrastar com o dedo também passa a foto.
 */
function Carrossel({ n, children }) {
  const trilho = useRef(null);
  const [i, setI] = useState(0);
  const ir = (d) => {
    const el = trilho.current;
    el.scrollTo({ left: (i + d) * el.clientWidth, behavior: 'smooth' });
  };
  return (
    <div className="feed-carrossel">
      <div ref={trilho} className="feed-carrossel-trilho"
        onScroll={(e) => setI(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
        {children}
      </div>
      {i > 0 && (
        <button type="button" className="feed-carrossel-seta is-esq" aria-label="Foto anterior" onClick={() => ir(-1)}>
          <ChevronLeft size={20} />
        </button>
      )}
      {i < n - 1 && (
        <button type="button" className="feed-carrossel-seta is-dir" aria-label="Próxima foto" onClick={() => ir(1)}>
          <ChevronRight size={20} />
        </button>
      )}
      <span className="feed-carrossel-conta" aria-live="polite">{i + 1}/{n}</span>
    </div>
  );
}

function FotosDoPost({ midias, links, onAbrir }) {
  const n = midias.length;
  if (!n) return null;
  const foto = (m, i) => (
    <button key={m.path} type="button" className="feed-foto" onClick={() => onAbrir(i)} aria-label={`Abrir foto ${i + 1} de ${n}`}>
      <img src={links[m.thumb] || links[m.path]} alt="" loading="lazy" decoding="async" />
    </button>
  );
  // Uma foto só: inteira e centralizada no card (com o feed na largura da
  // tela, esticá-la de ponta a ponta cortava a imagem).
  if (n === 1) return <div className="feed-fotos is-1">{foto(midias[0], 0)}</div>;
  return <Carrossel n={n}>{midias.map(foto)}</Carrossel>;
}

/**
 * Um post do feed. `links` é { [path]: url assinada } das fotos. Ações que
 * mudam o post avisam a página por `onMudou(postAtualizado)` ou
 * `onSumiu(id)`; erros sobem por `onErro`.
 */
export default function PostCard({ post, links, eu, moderador, destaque = false, onMudou, onAjustar, onSumiu, onErro }) {
  const { recarregar } = usePontos();
  const [menu, setMenu] = useState(false);
  const [editando, setEditando] = useState(false);
  const [textoEd, setTextoEd] = useState(post.texto);
  const [verComents, setVerComents] = useState(destaque);
  const [foto, setFoto] = useState(null);
  const [expandido, setExpandido] = useState(false);
  const meu = post.autor_id === eu;
  // No card vai a versão leve (`thumb`); a tela cheia abre a grande.
  const midias = (post.midia || []).filter((m) => links[m.thumb] || links[m.path]);
  const fotos = midias.map((m) => links[m.path] || links[m.thumb]);
  const longo = (post.texto || '').length > TEXTO_LONGO || (post.texto || '').split('\n').length > 6;

  const erro = (e) => onErro(e?.message || String(e));
  const atualizarTotal = useCallback(
    (n) => onAjustar(post.id, (p) => (p.comentarios === n ? p : { ...p, comentarios: n })),
    [onAjustar, post.id],
  );

  const alternarCurtida = async () => {
    // Otimista: o coração responde na hora; o banco devolve o total certo.
    const antes = post;
    onMudou({ ...post, curti: !post.curti, curtidas: post.curtidas + (post.curti ? -1 : 1) });
    try {
      const r = await api.curtir(post.id);
      if (r) onMudou({ ...antes, curti: r.curti, curtidas: r.curtidas });
    } catch (e) {
      onMudou(antes);
      erro(e);
    }
  };

  const salvarEdicao = async () => {
    try {
      await api.editarPost(post.id, textoEd);
      onMudou({ ...post, texto: textoEd.trim(), editado_em: new Date().toISOString() });
      setEditando(false);
    } catch (e) { erro(e); }
  };

  const acaoMenu = (fn) => async () => {
    setMenu(false);
    try { await fn(); } catch (e) { erro(e); }
  };

  const excluir = acaoMenu(async () => {
    if (!window.confirm('Apagar este post?')) return;
    await api.excluirPost(post.id);
    if (meu) recarregar(); // post que pagou pontos devolve os 25
    onSumiu(post.id);
  });
  const denunciarP = acaoMenu(async () => {
    const motivo = window.prompt('Por que este post não deveria estar aqui? (opcional)');
    if (motivo === null) return;
    await api.denunciar('post', post.id, motivo);
    window.alert('Denúncia enviada. A moderação vai olhar.');
  });
  const ocultar = acaoMenu(async () => {
    if (post.oculto) {
      await api.moderar('post', post.id, false);
      onMudou({ ...post, oculto: false, oculto_motivo: null });
      return;
    }
    const motivo = window.prompt('Motivo (o autor vê):');
    if (motivo === null) return;
    await api.moderar('post', post.id, true, motivo);
    onMudou({ ...post, oculto: true, oculto_motivo: motivo || null });
  });
  const alternarFixado = acaoMenu(async () => {
    await api.fixar(post.id, !post.fixado);
    onMudou({ ...post, fixado: !post.fixado });
  });

  return (
    <article id={`post-${post.id}`} className={`feed-post ${post.fixado ? 'is-fixado' : ''} ${post.oculto ? 'is-oculto' : ''} ${destaque ? 'is-destaque' : ''}`}>
      {destaque && (
        <div className="feed-fixado feed-marcado">
          <AtSign size={13} /> {(post.mencoes || []).some((m) => m.id === eu || m.id === MENCAO_TODOS.id) ? 'Marcaram você neste post' : 'Marcaram você num comentário deste post'}
        </div>
      )}
      {post.fixado && <div className="feed-fixado"><Pin size={13} /> Fixado</div>}
      <header className="feed-post-topo">
        <Autor id={post.autor_id} nome={post.autor_nome} funcao={post.autor_funcao} moldura={post.moldura} titulo={post.titulo}
          quando={`${tempoRelativo(post.criado_em)}${post.editado_em ? ' · editado' : ''}`} />
          <div className="feed-menu">
            <button type="button" className="feed-iconbtn" aria-label="Mais opções" aria-expanded={menu}
              onClick={() => setMenu((v) => !v)}><MoreHorizontal size={18} /></button>
            {menu && (
              <div className="feed-menu-lista" role="menu" onMouseLeave={() => setMenu(false)}>
                {meu && (
                  <button type="button" role="menuitem" onClick={() => { setMenu(false); setTextoEd(post.texto); setEditando(true); }}>
                    <Pencil size={14} /> Editar
                  </button>
                )}
                {(meu || moderador) && <button type="button" role="menuitem" onClick={excluir}><Trash2 size={14} /> Apagar</button>}
                {moderador && (
                  <button type="button" role="menuitem" onClick={alternarFixado}>
                    {post.fixado ? <><PinOff size={14} /> Desafixar</> : <><Pin size={14} /> Fixar no topo</>}
                  </button>
                )}
                {moderador && (
                  <button type="button" role="menuitem" onClick={ocultar}>
                    {post.oculto ? <><Eye size={14} /> Mostrar de novo</> : <><EyeOff size={14} /> Ocultar</>}
                  </button>
                )}
                {!meu && <button type="button" role="menuitem" onClick={denunciarP}><Flag size={14} /> Denunciar</button>}
              </div>
            )}
          </div>
      </header>

      {post.oculto && (
        <div className="feed-aviso">
          <EyeOff size={14} /> Oculto pela moderação{post.oculto_motivo ? `: ${post.oculto_motivo}` : ''}. Só você
          {moderador && !meu ? ' (moderação) e o autor veem' : ' vê'}.
        </div>
      )}

      {editando ? (
        <div className="feed-editar">
          <textarea value={textoEd} maxLength={TEXTO_MAX} rows={4} onChange={(e) => setTextoEd(e.target.value)}
            aria-label="Texto do post" />
          <div className="feed-editar-acoes">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditando(false)}>Cancelar</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={salvarEdicao}>Salvar</button>
          </div>
        </div>
      ) : (
        post.texto && (
          <>
            <p className={`feed-post-txt ${longo && !expandido ? 'is-cortado' : ''}`}><TextoComLinks texto={post.texto} mencoes={post.mencoes} /></p>
            {longo && (
              <button type="button" className="feed-vermais" onClick={() => setExpandido((v) => !v)}>
                {expandido ? 'ver menos' : '…ver mais'}
              </button>
            )}
          </>
        )
      )}

      {!editando && <FotosDoPost midias={midias} links={links} onAbrir={setFoto} />}

      <div className="feed-post-acoes">
        <button type="button" className={`feed-acao ${post.curti ? 'is-on' : ''}`} aria-pressed={post.curti}
          onClick={alternarCurtida} disabled={post.oculto && !meu}
          aria-label={`${post.curti ? 'Remover curtida' : 'Curtir'} (${plural(post.curtidas, 'curtida', 'curtidas')})`}>
          <Heart size={17} fill={post.curti ? 'currentColor' : 'none'} /> {post.curtidas}
        </button>
        <button type="button" className={`feed-acao ${verComents ? 'is-aberto' : ''}`} aria-expanded={verComents}
          onClick={() => setVerComents((v) => !v)}
          aria-label={`${verComents ? 'Ocultar' : 'Ver'} comentários (${post.comentarios})`}>
          <MessageCircle size={17} /> {post.comentarios}
        </button>
      </div>

      {verComents && (
        <Comentarios postId={post.id} eu={eu} moderador={moderador} podeComentar={!post.oculto}
          onTotal={atualizarTotal} onErro={onErro} />
      )}

      {foto !== null && <Visualizador fotos={fotos} inicio={foto} onFechar={() => setFoto(null)} />}
    </article>
  );
}
