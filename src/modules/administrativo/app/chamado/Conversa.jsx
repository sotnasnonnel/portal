import { useEffect, useRef, useState } from 'react';
import {
  CircleDot, FileText, Loader2, Lock, MessageSquare, Paperclip, Send, X,
} from 'lucide-react';
import { responder } from '../../lib/chamados';
import { textoDoEvento } from '../../lib/linhaDoTempo';
import { formatarTamanho } from '../../lib/arquivo';
import { ehEncerrado, proximoStatusAoResponder, STATUS_LABEL } from '../../lib/statusChamado';
import { formatarDataHora } from '../../../../utils/formatters';

const dataHora = (iso) => formatarDataHora(iso, '—');

const iniciais = (nome) => (nome || '?')
  .split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

/** Quem é o autor neste chamado: o nome sozinho não diz de que lado a pessoa está. */
function papelDoAutor(autorId, chamado) {
  if (autorId === chamado.solicitante_id) return 'Solicitante';
  if (autorId === chamado.atendente_id) return 'Responsável';
  return '';
}

function Mensagem({ dado, chamado, meuId, abrirAnexo }) {
  const minha = dado.autor_id === meuId;
  const papel = papelDoAutor(dado.autor_id, chamado);
  return (
    <li className={`adm-msg ${minha ? 'is-minha' : ''} ${dado.interna ? 'is-interna' : ''}`}>
      <div className="adm-msg-cab">
        <span className="adm-ch-avatar" aria-hidden="true">{iniciais(dado.autorNome)}</span>
        <strong>{minha ? 'Você' : (dado.autorNome || 'Usuário')}</strong>
        {papel && <span className="adm-ch-papel">{papel}</span>}
        {dado.interna && <span className="adm-msg-tag"><Lock size={11} aria-hidden="true" /> Nota interna</span>}
        <time className="adm-ch-msg-hora">{dataHora(dado.created_at)}</time>
      </div>
      {/* Mensagem só de anexo (o arquivo É o recado) não desenha parágrafo vazio
          no meio da conversa. */}
      {dado.mensagem && <p>{dado.mensagem}</p>}
      {(dado.anexos || []).length > 0 && (
        <ul className="adm-anexo-lista">
          {dado.anexos.map((a) => (
            <li key={a.path} className="adm-anexo-item">
              <Paperclip size={14} aria-hidden="true" />
              <button type="button" className="adm-link" onClick={() => abrirAnexo(a.path)}>{a.nome}</button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Mensagens e eventos numa lista só: é o que mostra ao solicitante que o pedido
 * andou, mesmo quando ninguém escreveu nada.
 *
 * A caixa de resposta fica presa ao pé da tela enquanto a conversa está à vista:
 * é o que se usa o tempo todo, e numa conversa longa ela ficaria a várias
 * rolagens de distância. Em chamado encerrado ela não se fixa, porque ali
 * responder deixou de ser a ação principal.
 */
export default function Conversa({
  chamado, linhaDoTempo, nomesEventos, meuId, souAdm, souSolicitante, ocupado, acao, abrirAnexo,
}) {
  const [mensagem, setMensagem] = useState('');
  const [interna, setInterna] = useState(false);
  // Anexo da RESPOSTA. O chamado já nascia podendo anexar, mas depois de aberto
  // a única saída era mandar o arquivo por fora (e-mail, WhatsApp) e o chamado
  // ficava sem o documento que resolveu o caso.
  const [arquivos, setArquivos] = useState([]);
  const [aviso, setAviso] = useState('');
  const inputArquivo = useRef(null);
  const caixa = useRef(null);
  const cartao = useRef(null);
  const aguardandoNova = useRef(false);

  const encerrado = ehEncerrado(chamado.status);
  const podeEnviar = (mensagem.trim() !== '' || arquivos.length > 0) && ocupado !== 'msg';
  // Responder passa a bola, e o quadro muda junto. Melhor dizer antes do envio do
  // que o atendente descobrir depois que o chamado saiu da coluna dele.
  const proximo = proximoStatusAoResponder({ statusAtual: chamado.status, souSolicitante, interna });

  // Mesma mecânica da abertura do chamado: acumula os escolhidos e permite
  // reescolher o mesmo arquivo depois de remover (daí zerar o value).
  const adicionarArquivos = (e) => {
    const novos = Array.from(e.target.files || []);
    if (novos.length) setArquivos((atual) => [...atual, ...novos]);
    e.target.value = '';
  };
  const removerArquivo = (idx) => setArquivos((atual) => atual.filter((_, i) => i !== idx));

  const enviar = () => {
    if (!podeEnviar) return;
    acao('msg', async () => {
      // Responder passa a bola: o Adm joga para "aguardando solicitante"
      // e o solicitante devolve para "em atendimento".
      await responder({
        chamado, autorId: meuId, mensagem, interna, arquivos, souSolicitante,
      });
      setMensagem('');
      setInterna(false);
      setArquivos([]);
      setAviso(interna ? 'Nota interna salva.' : 'Mensagem enviada.');
      aguardandoNova.current = true;
    });
  };

  // A mensagem nova nasce acima da caixa fixa e pode ficar fora da tela se a
  // pessoa não estava no fim da conversa. Rola até o pé do cartão, onde a caixa
  // volta à posição natural, sem cobrir nada.
  useEffect(() => {
    if (!aguardandoNova.current) return;
    aguardandoNova.current = false;
    cartao.current?.scrollIntoView({ block: 'end' });
    // No toque, devolver o foco abriria o teclado sem a pessoa pedir.
    if (window.matchMedia('(pointer: fine)').matches) caixa.current?.focus({ preventScroll: true });
  }, [linhaDoTempo.length]);

  useEffect(() => {
    if (!aviso) return undefined;
    const t = setTimeout(() => setAviso(''), 5000);
    return () => clearTimeout(t);
  }, [aviso]);

  return (
    <section className="adm-card adm-ch-conversa" aria-labelledby="adm-ch-conversa-tit" ref={cartao}>
      <div className="adm-ch-conversa-corpo">
        <h2 className="adm-card-tit" id="adm-ch-conversa-tit">Conversa e histórico</h2>
        {linhaDoTempo.length === 0 ? (
          <p className="adm-campo-dica">Nada registrado ainda.</p>
        ) : (
          <ul className="adm-msgs">
            {linhaDoTempo.map((item) => (item.tipo === 'evento' ? (
              <li key={`ev-${item.dado.id}`} className="adm-evento">
                <CircleDot size={12} aria-hidden="true" />
                <span>{textoDoEvento(item.dado, nomesEventos)}</span>
                <time>{dataHora(item.em)}</time>
              </li>
            ) : (
              <Mensagem
                key={item.dado.id} dado={item.dado} chamado={chamado} meuId={meuId} abrirAnexo={abrirAnexo}
              />
            )))}
          </ul>
        )}
      </div>

      {/* Nota interna precisa ser inconfundível: a caixa inteira muda de cor, o
          aviso aparece por extenso e o botão troca de nome, para ninguém mandar ao
          solicitante o que era para a equipe (nem o contrário). */}
      <div className={`adm-ch-caixa ${encerrado ? '' : 'is-fixa'} ${interna ? 'is-interna' : ''}`}>
        {souAdm && (
          <div className="adm-ch-modo" role="radiogroup" aria-label="Tipo de mensagem">
            <label className={!interna ? 'is-on' : ''}>
              <input type="radio" name="adm-ch-modo" checked={!interna} onChange={() => setInterna(false)} />
              <MessageSquare size={14} aria-hidden="true" /> Responder
            </label>
            <label className={interna ? 'is-on' : ''}>
              <input type="radio" name="adm-ch-modo" checked={interna} onChange={() => setInterna(true)} />
              <Lock size={14} aria-hidden="true" /> Nota interna
            </label>
          </div>
        )}

        {interna && (
          <p className="adm-ch-interna-aviso">
            <Lock size={14} aria-hidden="true" />
            <span><strong>Só a equipe vê.</strong> O solicitante não lê esta nota nem é avisado dela.</span>
          </p>
        )}

        <label htmlFor="msg" className="adm-ch-sr">{interna ? 'Nota interna' : 'Escreva sua mensagem'}</label>
        <textarea
          id="msg"
          ref={caixa}
          className="adm-textarea adm-ch-caixa-texto"
          rows={2}
          value={mensagem}
          placeholder={interna ? 'Escreva a nota para a equipe…' : 'Escreva sua mensagem…'}
          onChange={(e) => setMensagem(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); enviar(); }
          }}
        />

        {/* Anexo depois de aberto: o arquivo vai PRESO à mensagem, e não solto
            no chamado, para o histórico dizer quem mandou o quê e quando. */}
        <input
          id="msg-anexos"
          ref={inputArquivo}
          type="file"
          multiple
          onChange={adicionarArquivos}
          style={{ display: 'none' }}
        />
        {arquivos.length > 0 && (
          <ul className="adm-anexo-lista">
            {arquivos.map((a, i) => (
              <li key={`${a.name}-${i}`} className="adm-anexo-item">
                <FileText size={16} aria-hidden="true" />
                <span className="adm-anexo-nome" title={a.name}>{a.name}</span>
                <span className="adm-anexo-tam">{formatarTamanho(a.size)}</span>
                <button type="button" className="adm-anexo-x" onClick={() => removerArquivo(i)}
                  title="Remover" aria-label={`Remover ${a.name}`}>
                  <X size={15} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="adm-ch-caixa-pe">
          <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm"
            onClick={() => inputArquivo.current?.click()}>
            <Paperclip size={15} aria-hidden="true" /> Anexar
          </button>
          <span className="adm-ch-caixa-dica" role="status">
            {aviso ? <strong className="adm-ch-enviado">{aviso}</strong> : (
              encerrado
                ? 'Chamado encerrado: a mensagem fica registrada, mas não o reabre.'
                : proximo && `Ao enviar, o chamado passa para “${STATUS_LABEL[proximo]}”.`
            )}
          </span>
          <span className="adm-ch-atalho" aria-hidden="true">Ctrl+Enter</span>
          <button type="button"
            className={`adm-btn adm-btn-sm ${interna ? 'adm-ch-btn-nota' : 'adm-btn-primary'}`}
            aria-keyshortcuts="Control+Enter"
            disabled={!podeEnviar}
            onClick={enviar}>
            {ocupado === 'msg'
              ? <Loader2 size={15} className="adm-spin" aria-hidden="true" />
              : interna ? <Lock size={15} aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
            {interna ? 'Salvar nota interna' : 'Enviar'}
          </button>
        </div>
      </div>
    </section>
  );
}
