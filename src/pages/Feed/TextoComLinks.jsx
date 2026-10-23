import { pedacosDoTexto } from '../../config/feed';

/**
 * Texto de post ou comentário: endereços clicáveis e pessoas marcadas em
 * destaque. Só http(s) vira link (pedacosComLinks); abre em outra aba, sem
 * passar o portal como origem. `mencoes` = [{ id, nome }] gravadas no post.
 */
export default function TextoComLinks({ texto, mencoes = [] }) {
  return pedacosDoTexto(texto, mencoes).map((p, i) => {
    if (p.mencao) return <span key={i} className="feed-mencao">@{p.mencao}</span>;
    if (p.link) {
      return <a key={i} href={p.href} target="_blank" rel="noopener noreferrer nofollow" className="feed-link-url">{p.link}</a>;
    }
    return p.texto;
  });
}
