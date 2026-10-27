import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AtSign, Heart, MessageCircle, MoreHorizontal, Pin, PinOff, Pencil, Trash2, Flag, EyeOff, Eye, X,
  ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import { MENCAO_TODOS, midiaEhVideo, plural, resumoCurtidas, tempoRelativo, TEXTO_MAX } from '../../config/feed';
import { usePontos } from '../../contexts/PontosContext';
import * as api from '../../services/feed';
import { nomeProprio } from '../../utils/pessoas';
import Autor, { AvatarFeed } from './Autor';
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
 * Mais de uma mídia: uma por vez, com setas e o contador "2/5". O trilho rola
 * com scroll-snap, então no celular arrastar com o dedo também passa a mídia.
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
        <button type="button" className="feed-carrossel-seta is-esq" aria-label="Anterior" onClick={() => ir(-1)}>
          <ChevronLeft size={20} />
        </button>
      )}
      {i < n - 1 && (
        <button type="button" className="feed-carrossel-seta is-dir" aria-label="Próximo" onClick={() => ir(1)}>
          <ChevronRight size={20} />
        </button>
      )}
      <span className="feed-carrossel-conta" aria-live="polite">{i + 1}/{n}</span>
    </div>
  );
}

/**
 * A mídia do post: fotos e, quando tem, o vídeo — na ordem em que foram
 * escolhidas. A foto abre em tela cheia; o vídeo toca ali mesmo, com os
 * controles do navegador (a tela cheia dele é a do próprio player).
 *
 * `onAbrir` recebe a posição da foto ENTRE AS FOTOS, não entre as mídias: o
 * visualizador só navega por fotos, então um vídeo no meio não pode deslocar
 * o índice.
 */
function MidiasDoPost({ midias, links, onAbrir }) {
  const n = midias.length;
  if (!n) return null;
  let posFoto = -1;
  const item = (m) => {
    if (midiaEhVideo(m)) {
      return (
        <div key={m.path} className="feed-video">
          <video src={links[m.path]} poster={links[m.poster] || undefined} controls preload="metadata"
            playsInline controlsList="nodownload" />
        </div>
      );
    }
    posFoto += 1;
    const alvo = posFoto;
    return (
      <button key={m.path} type="button" className="feed-foto" onClick={() => onAbrir(alvo)}
        aria-label={`Abrir foto ${alvo + 1}`}>
        <img src={links[m.thumb] || links[m.path]} alt="" loading="lazy" decoding="async" />
      </button>
    );
  };
  // Uma mídia só: inteira e centralizada no card (com o feed na largura da
  // tela, esticá-la de ponta a ponta cortava a imagem).
  if (n === 1) return <div className="feed-fotos is-1">{item(midias[0])}</div>;
  return <Carrossel n={n}>{midias.map(item)}</Carrossel>;
}

/**
 * "Curtido por Você, Ana Souza e outras 2 pessoas" — a linha embaixo do post,
 * no molde do Instagram, com as bolinhas de quem curtiu e clique para abrir a
 * lista inteira. Enquanto o resumo não chega (ou se ele falhar), fica só a
 * contagem, que já vem no post.
 */
function CurtidoPor({ quem, total, eu, onAbrir }) {
  if (!total) return null;
  const { lista, resto } = resumoCurtidas(quem || [], total, eu);
  return (
    <button type="button" className="feed-curtido" onClick={onAbrir}
      aria-label={`Ver quem curtiu (${plural(total, 'curtida', 'curtidas')})`}>
      {lista.length > 0 && (
        <span className="feed-curtido-bolinhas" aria-hidden="true">
          {lista.map((p) => (
            <AvatarFeed key={p.colaborador_id} id={p.colaborador_id} nome={p.nome} moldura={p.moldura} />
          ))}
        </span>
      )}
      <span className="feed-curtido-txt">
        {lista.length === 0
          ? plural(total, 'curtida', 'curtidas')
          : <>
              Curtido por {lista.map((p, i) => (
                <span key={p.colaborador_id}>
                  {i > 0 && (i === lista.length - 1 && !resto ? ' e ' : ', ')}
                  <b>{p.euAqui ? 'Você' : nomeProprio(p.nome)}</b>
                </span>
              ))}
              {resto > 0 && (resto === 1 ? ' e outra pessoa' : ` e outras ${resto} pessoas`)}
            </>}
      </span>
    </button>
  );
}

/** Quem curtiu o post, inteiro, na lista que a linha de cima abre. */
function QuemCurtiu({ postId, total, onFechar, onErro }) {
  const [lista, setLista] = useState(null);
  useEffect(() => {
    let vivo = true;
    api.listarCurtidas(postId).then(
      (l) => { if (vivo) setLista(l); },
      (e) => { if (vivo) { setLista([]); onErro(e.message); } },
    );
    return () => { vivo = false; };
  }, [postId, onErro]);

  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onFechar]);

  // A RPC devolve no máximo 100; o resto sai como "e mais N".
  const sobrando = lista ? total - lista.length : 0;
  return (
    <div className="feed-modal-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div className="feed-modal is-curtidas" role="dialog" aria-modal="true" aria-labelledby="feed-curtidas-tit">
        <div className="feed-modal-cab">
          <h2 id="feed-curtidas-tit" className="feed-curtidas-tit">
            <Heart size={18} fill="currentColor" /> {plural(total, 'curtida', 'curtidas')}
          </h2>
          <button type="button" className="feed-iconbtn" aria-label="Fechar" onClick={onFechar}><X size={20} /></button>
        </div>
        {lista === null ? (
          <div className="feed-vazio"><Loader2 size={18} className="feed-spin" /> Carregando…</div>
        ) : lista.length === 0 ? (
          <div className="feed-vazio">Ninguém curtiu ainda.</div>
        ) : (
          <ul className="feed-curtidas-lista">
            {lista.map((p) => (
              <li key={p.colaborador_id}>
                <Autor id={p.colaborador_id} nome={p.nome} funcao={p.funcao} moldura={p.moldura} titulo={p.titulo}
                  quando={tempoRelativo(p.criado_em)} />
              </li>
            ))}
            {sobrando > 0 && <li className="feed-curtidas-mais">e mais {sobrando}</li>}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Um post do feed. `links` é { [path]: url assinada } das fotos. Ações que
 * mudam o post avisam a página por `onMudou(postAtualizado)` ou
 * `onSumiu(id)`; erros sobem por `onErro`.
 */
export default function PostCard({
  post, links, eu, moderador, quemCurtiu, destaque = false,
  onMudou, onAjustar, onSumiu, onErro, onCurtidasMudaram,
}) {
  const { recarregar } = usePontos();
  const [menu, setMenu] = useState(false);
  const [editando, setEditando] = useState(false);
  const [textoEd, setTextoEd] = useState(post.texto);
  const [verComents, setVerComents] = useState(destaque);
  const [foto, setFoto] = useState(null);
  const [verCurtidas, setVerCurtidas] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const meu = post.autor_id === eu;
  // Só o que tem link assinado: link vencido não deixa quadro vazio no card.
  // Na foto, o card usa a versão leve (`thumb`) e a tela cheia a grande; no
  // vídeo o que importa é o próprio arquivo (a capa é um extra).
  const midias = (post.midia || []).filter((m) => (midiaEhVideo(m) ? links[m.path] : links[m.thumb] || links[m.path]));
  const fotos = midias.filter((m) => !midiaEhVideo(m)).map((m) => links[m.path] || links[m.thumb]);
  const longo = (post.texto || '').length > TEXTO_LONGO || (post.texto || '').split('\n').length > 6;

  const erro = (e) => onErro(e?.message || String(e));
  // Estável: o QuemCurtiu usa isto num efeito (o Esc), e a cada render novo
  // ele religaria o atalho.
  const fecharCurtidas = useCallback(() => setVerCurtidas(false), []);
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
      // A linha "Curtido por…" tem de ganhar (ou perder) o meu nome.
      onCurtidasMudaram?.(post.id);
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

      {!editando && <MidiasDoPost midias={midias} links={links} onAbrir={setFoto} />}

      {/* data-tour: o passo a passo do feed aponta as ações do primeiro post. */}
      <div className="feed-post-acoes" data-tour="post-acoes">
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

      <CurtidoPor quem={quemCurtiu} total={post.curtidas} eu={eu} onAbrir={() => setVerCurtidas(true)} />

      {verComents && (
        <Comentarios postId={post.id} eu={eu} moderador={moderador} podeComentar={!post.oculto}
          onTotal={atualizarTotal} onErro={onErro} />
      )}

      {foto !== null && <Visualizador fotos={fotos} inicio={foto} onFechar={() => setFoto(null)} />}

      {verCurtidas && (
        <QuemCurtiu postId={post.id} total={post.curtidas} onFechar={fecharCurtidas} onErro={onErro} />
      )}
    </article>
  );
}
