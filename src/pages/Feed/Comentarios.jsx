import { useCallback, useEffect, useMemo, useState } from 'react';
import { CornerDownRight, Flag, EyeOff, Eye, Trash2, Loader2, SendHorizontal } from 'lucide-react';
import {
  agruparComentarios, COMENTARIO_MAX, mencoesNoTexto, nomeMencao, tempoRelativo,
} from '../../config/feed';
import * as api from '../../services/feed';
import { nomeProprio } from '../../utils/pessoas';
import Autor from './Autor';
import TextoComLinks from './TextoComLinks';
import CampoMencoes from './CampoMencoes';

/** Caixa de escrever comentário ou resposta. */
function CaixaComentario({ placeholder, onEnviar, autoFocus = false, onCancelar = null, textoInicial = '', mencoesIniciais = [] }) {
  const [texto, setTexto] = useState(textoInicial);
  const [mencoes, setMencoes] = useState(mencoesIniciais);
  const [enviando, setEnviando] = useState(false);
  const enviar = async (e) => {
    e.preventDefault();
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    try {
      await onEnviar(t, mencoesNoTexto(t, mencoes));
      setTexto('');
      setMencoes([]);
    } catch {
      // O erro já apareceu (onErro); o texto fica para tentar de novo.
    } finally {
      setEnviando(false);
    }
  };
  return (
    <form className={`feed-coment-caixa ${texto.trim() ? 'tem-texto' : ''}`} onSubmit={enviar}>
      <span className="feed-coment-campo">
        <CampoMencoes
          rows={1}
          value={texto}
          onChange={setTexto}
          mencoes={mencoes}
          onMencoes={setMencoes}
          maxLength={COMENTARIO_MAX}
          placeholder={placeholder}
          aria-label={placeholder}
          autoFocus={autoFocus}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) enviar(e); }}
        />
        {/* Enviar fica dentro da pílula, como no LinkedIn; acende com texto. */}
        <button type="submit" className="feed-btn-enviar" disabled={!texto.trim() || enviando}
          aria-label="Enviar comentário" title="Enviar (Enter)">
          {enviando ? <Loader2 size={16} className="feed-spin" /> : <SendHorizontal size={16} />}
        </button>
      </span>
      {onCancelar && <button type="button" className="feed-link feed-cancelar" onClick={onCancelar}>Cancelar</button>}
    </form>
  );
}

function Comentario({ c, eu, moderador, onResponder, onExcluir, onDenunciar, onModerar }) {
  if (c.excluido || c.texto === null) {
    return <div className="feed-coment is-removido">{c.excluido ? 'Comentário apagado.' : 'Comentário oculto pela moderação.'}</div>;
  }
  const meu = c.autor_id === eu;
  return (
    <div className={`feed-coment ${c.oculto ? 'is-oculto' : ''}`}>
      <Autor id={c.autor_id} nome={c.autor_nome} moldura={c.moldura} titulo={c.titulo} pequeno
        quando={`${tempoRelativo(c.criado_em)}${c.editado_em ? ' · editado' : ''}`} />
      <p className="feed-coment-txt"><TextoComLinks texto={c.texto} mencoes={c.mencoes} /></p>
      {c.oculto && <span className="feed-tag">Oculto pela moderação</span>}
      <div className="feed-coment-acoes">
        {onResponder && <button type="button" className="feed-link" onClick={onResponder}>Responder</button>}
        {(meu || moderador) && (
          <button type="button" className="feed-link" onClick={onExcluir}><Trash2 size={12} /> Apagar</button>
        )}
        {!meu && (
          <button type="button" className="feed-link" onClick={onDenunciar}><Flag size={12} /> Denunciar</button>
        )}
        {moderador && (
          <button type="button" className="feed-link" onClick={() => onModerar(!c.oculto)}>
            {c.oculto ? <><Eye size={12} /> Mostrar</> : <><EyeOff size={12} /> Ocultar</>}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Comentários de um post. Carrega ao abrir; avisa o card quando o total muda
 * (`onTotal`). Resposta é de um nível só, como no banco.
 */
export default function Comentarios({ postId, eu, moderador, podeComentar, onTotal, onErro }) {
  const [lista, setLista] = useState(null);
  // { topo, alvo, texto, mencoes, chave }: a resposta vai para o comentário de
  // cima (um nível só) e já nasce marcando quem se responde, como no LinkedIn.
  const [respondendo, setRespondendo] = useState(null);
  const responder = (topo, alvo) => {
    const nome = nomeMencao(alvo.autor_nome);
    const outro = alvo.autor_id !== eu;
    setRespondendo({
      topo: topo.id, alvo, chave: alvo.id,
      texto: outro ? `@${nome} ` : '',
      mencoes: outro ? [{ id: alvo.autor_id, nome }] : [],
    });
  };

  const carregar = useCallback(async () => {
    try {
      const l = await api.listarComentarios(postId);
      setLista(l);
      onTotal?.(l.filter((c) => !c.excluido).length);
    } catch (e) {
      onErro?.(e.message);
      setLista([]);
    }
  }, [postId, onTotal, onErro]);

  useEffect(() => {
    // O estado só muda depois do await — não há render em cascata.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  const arvore = useMemo(() => agruparComentarios(lista || []), [lista]);

  const acao = (fn) => async (...args) => {
    try {
      await fn(...args);
      await carregar();
    } catch (e) {
      onErro?.(e.message);
    }
  };
  // Enviar repassa o erro: a caixa só limpa (ou fecha a resposta) se o
  // comentário entrou. Com `acao`, um limite do dia apagava o texto digitado.
  const enviar = async (texto, pai, mencoes) => {
    try {
      await api.comentar(postId, texto, pai, mencoes);
    } catch (e) {
      onErro?.(e.message);
      throw e;
    }
    await carregar();
  };
  const excluir = acao(async (id) => {
    if (window.confirm('Apagar este comentário?')) await api.excluirComentario(id);
  });
  const moderarC = acao((id, ocultar) => api.moderar('comentario', id, ocultar));
  const denunciarC = async (id) => {
    const motivo = window.prompt('Por que este comentário não deveria estar aqui? (opcional)');
    if (motivo === null) return;
    try {
      await api.denunciar('comentario', id, motivo);
      window.alert('Denúncia enviada. A moderação vai olhar.');
    } catch (e) {
      onErro?.(e.message);
    }
  };

  if (lista === null) return <div className="feed-coments"><Loader2 size={16} className="feed-spin" /></div>;

  const props = (c) => ({
    c, eu, moderador,
    onExcluir: () => excluir(c.id),
    onDenunciar: () => denunciarC(c.id),
    onModerar: (ocultar) => moderarC(c.id, ocultar),
  });

  return (
    <div className="feed-coments">
      {arvore.map((c) => (
        <div key={c.id} className="feed-coment-fio">
          <Comentario {...props(c)} onResponder={podeComentar ? () => responder(c, c) : null} />
          {(c.respostas.length > 0 || respondendo?.topo === c.id) && (
            <div className="feed-respostas">
              {c.respostas.map((r) => (
                <Comentario key={r.id} {...props(r)} onResponder={podeComentar ? () => responder(c, r) : null} />
              ))}
              {respondendo?.topo === c.id && (
                <div className="feed-responder">
                  <CornerDownRight size={14} aria-hidden="true" />
                  <CaixaComentario key={respondendo.chave} autoFocus
                    placeholder={`Responder a ${nomeProprio(respondendo.alvo.autor_nome).split(' ')[0]}…`}
                    textoInicial={respondendo.texto} mencoesIniciais={respondendo.mencoes}
                    onCancelar={() => setRespondendo(null)}
                    onEnviar={async (t, m) => { await enviar(t, c.id, m); setRespondendo(null); }} />
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      {podeComentar && <CaixaComentario placeholder="Escreva um comentário…" onEnviar={(t, m) => enviar(t, null, m)} />}
    </div>
  );
}
