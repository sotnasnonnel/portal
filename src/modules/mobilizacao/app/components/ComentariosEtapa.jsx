import { useRef, useState } from 'react';
import {
  MessageSquare, Paperclip, FileText, X, Send, Loader2, ChevronDown, ChevronRight,
  Pencil, History,
} from 'lucide-react';
import {
  comentarEtapa, editarComentarioEtapa, listarVersoesComentario, urlDoAnexoMob,
} from '../../lib/mobilizacao';
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
 *
 * EDIÇÃO: cada um corrige o que escreveu (a RLS também barra o resto). A
 * mensagem editada diz "Editada", com data, hora e quem editou, e as versões
 * anteriores abrem ali mesmo — sem isso, corrigir um texto apagaria em silêncio
 * aquilo a que alguém já respondeu.
 */
export default function ComentariosEtapa({ etapaId, comentarios = [], meuId, onEnviado }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [arquivos, setArquivos] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [editando, setEditando] = useState(null);      // id do comentário em edição
  const [textoEdicao, setTextoEdicao] = useState('');
  const [versoes, setVersoes] = useState({});          // id -> versões já buscadas
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

  const comecarEdicao = (c) => {
    setEditando(c.id);
    setTextoEdicao(c.texto || '');
    setErro('');
  };

  const salvarEdicao = async () => {
    setEnviando(true);
    setErro('');
    try {
      await editarComentarioEtapa(editando, textoEdicao);
      setEditando(null);
      await onEnviado();
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  };

  // As versões só são buscadas quando alguém quer vê-las: são poucas, mas são
  // uma consulta por comentário, e a tela já carrega o processo inteiro.
  const verVersoes = async (comentarioId) => {
    if (versoes[comentarioId]) {
      setVersoes((v) => ({ ...v, [comentarioId]: null }));
      return;
    }
    try {
      const lista = await listarVersoesComentario(comentarioId);
      setVersoes((v) => ({ ...v, [comentarioId]: lista }));
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
                    {/* Só o autor edita, e só o texto: anexo não se corrige. */}
                    {c.autor_id === meuId && c.texto && editando !== c.id && (
                      <button type="button" className="mob-coment-editar" onClick={() => comecarEdicao(c)}>
                        <Pencil size={12} /> Editar
                      </button>
                    )}
                  </div>

                  {editando === c.id ? (
                    <div className="mob-coment-edicao">
                      <textarea className="mob-coment-campo" rows={2} value={textoEdicao}
                        onChange={(ev) => setTextoEdicao(ev.target.value)} />
                      <div className="mob-coment-acoes">
                        <button type="button" className="mob-btn mob-btn-ghost mob-btn-sm"
                          disabled={enviando} onClick={() => setEditando(null)}>
                          Cancelar
                        </button>
                        <button type="button" className="mob-btn mob-btn-primary mob-btn-sm"
                          disabled={enviando || !textoEdicao.trim()} onClick={salvarEdicao}>
                          {enviando ? <Loader2 size={14} className="mob-spin" /> : null} Salvar
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Comentário só de anexo não desenha parágrafo vazio. */
                    c.texto && <p className="mob-coment-txt">{c.texto}</p>
                  )}

                  {c.editado_em && editando !== c.id && (
                    <div className="mob-coment-editada">
                      <span>
                        Editada em {dataHora(c.editado_em)}
                        {c.editadoPorNome ? ` por ${c.editadoPorNome}` : ''}
                      </span>
                      <button type="button" className="mob-link" onClick={() => verVersoes(c.id)}>
                        <History size={12} /> {versoes[c.id] ? 'ocultar versões' : 'ver versões'}
                      </button>
                    </div>
                  )}

                  {versoes[c.id]?.length > 0 && (
                    <ul className="mob-coment-versoes">
                      {versoes[c.id].map((v) => (
                        <li key={v.id}>
                          <span className="mob-coment-versao-cab">
                            Até {dataHora(v.vigorou_ate)}
                            {v.editadoPorNome ? ` · trocada por ${v.editadoPorNome}` : ''}
                          </span>
                          <p className="mob-coment-txt">{v.texto}</p>
                        </li>
                      ))}
                    </ul>
                  )}
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
