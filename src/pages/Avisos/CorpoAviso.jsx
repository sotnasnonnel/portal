import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileText, Loader2 } from 'lucide-react';
import { blocosDoTexto, normalizarUrl, pedacosFormatados, tamanhoLegivel } from '../../config/avisos';
import { linkDeDownload } from '../../services/avisos';

// Uma linha com **negrito**, _itálico_ e links. Tudo vira elemento React: o
// texto do aviso nunca é tratado como HTML.
function Linha({ texto }) {
  return pedacosFormatados(texto).map((p, i) => {
    let el = p.link
      ? <a key={i} href={p.href} target="_blank" rel="noopener noreferrer">{p.link}</a>
      : p.texto;
    if (p.italico) el = <i key={i}>{el}</i>;
    if (p.negrito) el = <b key={i}>{el}</b>;
    return typeof el === 'string' ? <span key={i}>{el}</span> : el;
  });
}

export function TextoAviso({ texto }) {
  return blocosDoTexto(texto).map((b, i) => {
    if (b.tipo === 'h') return <h3 key={i}><Linha texto={b.texto} /></h3>;
    if (b.tipo === 'ul' || b.tipo === 'ol') {
      const Lista = b.tipo;
      return <Lista key={i}>{b.itens.map((t, k) => <li key={k}><Linha texto={t} /></li>)}</Lista>;
    }
    return (
      <p key={i}>
        {b.linhas.map((l, k) => (
          <span key={k}>{k > 0 && <br />}<Linha texto={l} /></span>
        ))}
      </p>
    );
  });
}

function Botao({ rotulo, url: bruta }) {
  // O banco só aceita http(s) ou "/", mas a prévia do editor mostra o que está
  // sendo digitado: normalizar aqui impede um "javascript:" de virar link.
  const url = normalizarUrl(bruta);
  // Caminho do portal abre aqui mesmo; endereço de fora, em outra aba.
  if (url.startsWith('/')) return <Link className="aviso-botao" to={url}>{rotulo}</Link>;
  return <a className="aviso-botao" href={url} target="_blank" rel="noopener noreferrer">{rotulo}</a>;
}

function Anexo({ bloco }) {
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState('');
  const nome = bloco.nome || bloco.arquivo?.name || 'Arquivo';
  const tamanho = bloco.tamanho ?? bloco.arquivo?.size;
  const baixar = async () => {
    if (!bloco.path) return; // ainda não salvo: só a prévia
    setBaixando(true);
    setErro('');
    try {
      window.location.assign(await linkDeDownload(bloco.path, nome));
    } catch (e) {
      setErro(e.message);
    } finally {
      setBaixando(false);
    }
  };
  return (
    <div className="aviso-anexo">
      <FileText size={20} aria-hidden="true" />
      <div className="aviso-anexo-nome">
        <b>{nome}</b>
        {tamanho != null && <span>{tamanhoLegivel(tamanho)}</span>}
        {erro && <span className="aviso-erro-inline">{erro}</span>}
      </div>
      <button type="button" className="btn btn-outline btn-sm" onClick={baixar} disabled={!bloco.path || baixando}>
        {baixando ? <Loader2 size={14} className="aviso-spin" /> : <Download size={14} />} Baixar
      </button>
    </div>
  );
}

/**
 * Corpo do aviso, bloco a bloco. `links` são os links assinados por `path`;
 * na prévia do editor, o bloco recém-escolhido traz `preview` (URL local).
 */
export default function CorpoAviso({ blocos = [], links = {} }) {
  return (
    <div className="aviso-corpo">
      {blocos.map((b, i) => {
        if (b.tipo === 'texto') return <div key={i} className="aviso-texto"><TextoAviso texto={b.texto} /></div>;
        if (b.tipo === 'botao') {
          if (!b.rotulo?.trim() || !b.url?.trim()) return null;
          return <div key={i}><Botao rotulo={b.rotulo} url={b.url} /></div>;
        }
        if (b.tipo === 'imagem') {
          const src = b.preview || links[b.path];
          if (!src) return null;
          return (
            <figure key={i} className="aviso-figura">
              <img src={src} alt={b.legenda || ''} width={b.width} height={b.height} loading="lazy" />
              {b.legenda && <figcaption>{b.legenda}</figcaption>}
            </figure>
          );
        }
        if (b.tipo === 'anexo') {
          if (!b.path && !b.arquivo) return null;
          return <Anexo key={i} bloco={b} />;
        }
        return null;
      })}
    </div>
  );
}
