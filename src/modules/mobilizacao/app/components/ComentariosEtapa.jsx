import { useRef, useState } from 'react';
import {
  MessageSquare, Paperclip, FileText, X, Send, Loader2, ChevronDown, ChevronRight,
} from 'lucide-react';
import { comentarEtapa, urlDoAnexoMob } from '../../lib/mobilizacao';
import { formatarTamanho } from '../../../administrativo/lib/arquivo';

const dataHora = (iso) => (iso
  ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  : '');

/**
 * Comentários de uma etapa, com anexo.
 *
 * O pedido eram duas coisas — "campos de comentários para cada etapa, com quem
 * fez e data" e "botão de anexar arquivo em cada etapa" — e viraram um
 * mecanismo só. O arquivo quase sempre vem acompanhado da explicação ("a
 * clínica remarcou, segue a guia nova"); separados, a etapa teria duas listas
 * paralelas e o arquivo perderia o porquê. Comentário só com anexo é permitido:
 * aí o arquivo é o recado.
 *
 * FECHADO por padrão. Um processo tem até vinte passos, e vinte caixas de
 * conversa abertas empurrariam o passo a passo — que é a razão da tela — para
 * fora do campo de visão. O contador no cabeçalho é o que diz onde há conversa
 * sem precisar abrir.
 *
 * A lista de "Arquivos desta etapa" repete os anexos que já aparecem nos
 * comentários, de propósito: quem procura um documento não quer ler a conversa
 * inteira para achá-lo.
 */
export default function ComentariosEtapa({ etapaId, comentarios = [], meuId, onEnviado }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [arquivos, setArquivos] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const inputArquivo = useRef(null);

  // Todos os anexos da etapa, com o autor de cada um — é a lista consolidada.
  const todosAnexos = comentarios.flatMap((c) => (c.anexos || []).map((a) => ({
    ...a, autorNome: c.autorNome, quando: c.created_at, comentarioId: c.id,
  })));

  const adicionar = (e) => {
    const novos = Array.from(e.target.files || []);
    if (novos.length) setArquivos((atual) => [...atual, ...novos]);
    e.target.value = '';   // permite reescolher o mesmo arquivo depois de remover
  };

  const remover = (idx) => setArquivos((atual) => atual.filter((_, i) => i !== idx));

  const abrirAnexo = async (path) => {
    try {
      window.open(await urlDoAnexoMob(path), '_blank', 'noopener');
    } catch (e) {
      setErro(e.message);
    }
  };

  const enviar = async () => {
    setEnviando(true);
    setErro('');
    try {
      await comentarEtapa({ etapaId, autorId: meuId, texto, arquivos });
      setTexto('');
      setArquivos([]);
      await onEnviado();
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const vazio = !texto.trim() && arquivos.length === 0;

  return (
    <div className="mob-coment">
      <button type="button" className="mob-coment-toggle" onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}>
        {aberto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <MessageSquare size={14} />
        Comentários
        {comentarios.length > 0 && <span className="mob-coment-cont">{comentarios.length}</span>}
        {todosAnexos.length > 0 && (
          <span className="mob-coment-cont" title={`${todosAnexos.length} arquivo(s)`}>
            <Paperclip size={11} /> {todosAnexos.length}
          </span>
        )}
      </button>

      {aberto && (
        <div className="mob-coment-corpo">
          {erro && <p className="mob-coment-erro">{erro}</p>}

          {!comentarios.length ? (
            <p className="mob-campo-dica">Nenhum comentário nesta etapa ainda.</p>
          ) : (
            <ul className="mob-coment-lista">
              {comentarios.map((c) => (
                <li key={c.id} className="mob-coment-item">
                  <div className="mob-coment-cab">
                    <strong>{c.autorNome || 'Usuário'}</strong>
                    <span>{dataHora(c.created_at)}</span>
                  </div>
                  {/* Comentário só de anexo não desenha parágrafo vazio. */}
                  {c.texto && <p className="mob-coment-txt">{c.texto}</p>}
                  {(c.anexos || []).length > 0 && (
                    <ul className="mob-anexo-lista">
                      {c.anexos.map((a) => (
                        <li key={a.path} className="mob-anexo-item">
                          <Paperclip size={13} />
                          <button type="button" className="mob-link" onClick={() => abrirAnexo(a.path)}>
                            {a.nome}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="mob-campo">
            <label htmlFor={`coment-${etapaId}`}>Escreva um comentário</label>
            <textarea id={`coment-${etapaId}`} className="mob-coment-campo" rows={2}
              value={texto} onChange={(e) => setTexto(e.target.value)}
              placeholder="Explique o que aconteceu neste passo…" />
          </div>

          <input id={`anexo-${etapaId}`} ref={inputArquivo} type="file" multiple
            onChange={adicionar} style={{ display: 'none' }} />

          {arquivos.length > 0 && (
            <ul className="mob-anexo-lista">
              {arquivos.map((a, i) => (
                <li key={`${a.name}-${i}`} className="mob-anexo-item">
                  <FileText size={13} />
                  <span className="mob-anexo-nome" title={a.name}>{a.name}</span>
                  <span className="mob-anexo-tam">{formatarTamanho(a.size)}</span>
                  <button type="button" className="mob-anexo-x" onClick={() => remover(i)} title="Remover">
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mob-coment-acoes">
            <button type="button" className="mob-btn mob-btn-ghost mob-btn-sm" disabled={enviando}
              onClick={() => inputArquivo.current?.click()}>
              <Paperclip size={14} /> Anexar arquivo
            </button>
            <button type="button" className="mob-btn mob-btn-primary mob-btn-sm"
              disabled={vazio || enviando} onClick={enviar}>
              {enviando ? <Loader2 size={14} className="mob-spin" /> : <Send size={14} />} Enviar
            </button>
          </div>

          {todosAnexos.length > 0 && (
            <div className="mob-coment-arquivos">
              <span className="mob-coment-arquivos-tit">
                <Paperclip size={12} /> Arquivos desta etapa ({todosAnexos.length})
              </span>
              <ul className="mob-anexo-lista">
                {todosAnexos.map((a) => (
                  <li key={`${a.comentarioId}-${a.path}`} className="mob-anexo-item">
                    <FileText size={13} />
                    <button type="button" className="mob-link" onClick={() => abrirAnexo(a.path)}>
                      {a.nome}
                    </button>
                    <span className="mob-anexo-tam">
                      {a.autorNome} · {dataHora(a.quando)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
