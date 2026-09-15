import { useEffect, useRef, useState } from 'react';
import { X, Paperclip, Loader2 } from 'lucide-react';
import { lerComentariosEtapas, lerUltimasMensagens } from '../../lib/dados';
import { rotuloFluxo, STATUS_PROCESSO } from '../../../../config/mobilizacao';
import { corDaCelula, ROTULO_COR } from '../../../mobilizacao/lib/matriz';
import { rotuloStatus } from '../../../mobilizacao/lib/statusEtapa';
import { STATUS_LABEL as STATUS_CHAMADO } from '../../../administrativo/lib/statusChamado';
import { semaforoPrazo } from '../../../../utils/semaforo';

const dataBr = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');
const dataHora = (iso) => (iso
  ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  : '—');

const textoAtraso = (dias) => {
  const n = Number(dias);
  if (!Number.isFinite(n)) return '—';
  if (n > 0) return `${n}d de atraso`;
  if (n < 0) return `${Math.abs(n)}d de folga`;
  return 'no dia';
};

/**
 * O detalhe por trás de cada item do Mapa da Torre.
 *
 * Nasceu do pedido da reunião de torre: a apresentação acontece nesta tela, e
 * quando alguém pergunta "o que exatamente travou nesse passo?" a resposta
 * estava em OUTRO módulo. Trocar de módulo no meio da reunião perde a tela de
 * todo mundo, e boa parte de quem assiste nem tem acesso ao módulo de
 * Mobilização (as listas de liberados não são as mesmas) — clicar levaria a
 * pessoa a uma rota bloqueada. Por isso o detalhe vem até aqui, e não há link
 * para fora.
 *
 * SÓ LEITURA, como o módulo inteiro. Nenhum botão de ação, de propósito: a
 * Torre existe para conferir, e mexer no processo no meio da reunião — sem o
 * contexto que a tela do processo dá — é exatamente o que o módulo evita.
 *
 * O conteúdo se limita ao que as RPCs da Torre devolvem. Isso não é um detalhe
 * de implementação: `chamados_adm.campos` guarda CPF, RG e nascimento, e ficou
 * FORA da Torre de propósito (ver lib/dados.js). Um popup "com todos os
 * detalhes" que fosse buscar o formulário desfaria essa decisão calado.
 */
export default function DetalheMapa({ item, onFechar }) {
  const fecharRef = useRef(null);

  // Esc fecha, e o foco começa no botão de fechar: quem abriu por teclado
  // precisa conseguir sair por teclado.
  useEffect(() => {
    fecharRef.current?.focus();
    const aoTeclar = (e) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  if (!item) return null;
  const ehProcesso = item.tipo === 'processo';

  return (
    <div className="mob-modal-fundo" role="presentation" onClick={onFechar}>
      {/* stopPropagation: clicar DENTRO do painel não pode fechar. */}
      <div className="mob-modal" role="dialog" aria-modal="true" aria-label={item.titulo}
        onClick={(e) => e.stopPropagation()}>
        <header className="mob-modal-cab">
          <div>
            <h2 className="mob-modal-tit">{item.titulo}</h2>
            <p className="mob-modal-sub">{item.descricao}</p>
          </div>
          <button type="button" ref={fecharRef} className="mob-btn mob-btn-ghost mob-btn-sm"
            onClick={onFechar} aria-label="Fechar">
            <X size={16} />
          </button>
        </header>

        <div className="mob-modal-corpo">
          {ehProcesso
            ? <CorpoProcesso processo={item.processo} etapas={item.etapas} destaque={item.destaque} />
            : <CorpoChamados chamados={item.chamados} agora={item.agora} />}
        </div>
      </div>
    </div>
  );
}

/**
 * Mobilização e desmobilização: o cabeçalho do processo e TODOS os passos.
 *
 * A lista inteira, e não só o passo clicado, porque a pergunta que vem depois
 * de "o que travou aqui?" é sempre "e o resto, como está?".
 */
function CorpoProcesso({ processo, etapas = [], destaque }) {
  // null = carregando. Os comentários vêm DEPOIS do popup abrir, de propósito:
  // o passo a passo já está em memória e aparece na hora; esperar a consulta
  // para mostrar qualquer coisa deixaria o popup em branco na frente da sala.
  const [coment, setComent] = useState(null);
  useEffect(() => {
    let vivo = true;
    lerComentariosEtapas(etapas.map((e) => e.id)).then((r) => { if (vivo) setComent(r); });
    return () => { vivo = false; };
  }, [etapas]);

  return (
    <>
      <div className="mob-grid2">
        <Campo rot="Fluxo" val={rotuloFluxo(processo.fluxo)} />
        <Campo rot="Situação" val={STATUS_PROCESSO[processo.status] || processo.status} />
        <Campo rot="Profissional" val={processo.profissional_nome} />
        <Campo rot="Cliente PHD" val={processo.cliente_phd} />
        <Campo rot="Local da obra" val={processo.local_obra} />
        <Campo rot="Cód. CT" val={processo.cod_ct} />
        <Campo rot="Responsável" val={processo.responsavelNome} />
        <Campo rot="Prazo do processo" val={dataBr(processo.prazo_em)} />
      </div>

      {!etapas.length ? (
        <p className="mob-campo-dica">Este processo ainda não tem passos.</p>
      ) : (
        <div className="mob-tabela-scroll" style={{ marginTop: 12 }}>
          <table className="mob-tabela">
            <thead>
              <tr>
                <th className="num">#</th><th>Passo</th><th>Situação</th>
                <th>Previsto</th><th>Real</th><th>Prazo</th><th>Comentários</th>
              </tr>
            </thead>
            <tbody>
              {etapas.map((e) => {
                const cor = corDaCelula(e);
                return (
                  // A linha do passo clicado fica marcada: sem isso, quem clicou
                  // numa bolinha no meio de vinte passos perde de vista qual era.
                  <tr key={e.id} className={destaque && e.codigo === destaque ? 'is-destaque' : ''}>
                    <td className="num">{e.ordem}</td>
                    <td>{e.titulo}</td>
                    <td>
                      <span className={`mob-bolinha tom-${cor}`} aria-hidden="true" />
                      {' '}{rotuloStatus(e.status)}
                      <span className="mob-so-leitor"> — {ROTULO_COR[cor]}</span>
                    </td>
                    <td>{dataBr(e.data_prevista)}</td>
                    <td>{dataBr(e.data_real)}</td>
                    <td>{textoAtraso(e.dias_atraso)}</td>
                    <td className="tor-det-coment">
                      <CelulaComentarios estado={coment} lista={coment?.porId.get(e.id) || []} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** Chamados de uma célula (ou de uma linha inteira) da matriz do Adm. */
function CorpoChamados({ chamados = [], agora }) {
  // Mesma lógica do processo: a lista aparece na hora, a última mensagem chega
  // em seguida.
  const [msgs, setMsgs] = useState(null);
  useEffect(() => {
    let vivo = true;
    lerUltimasMensagens(chamados.map((c) => c.id)).then((r) => { if (vivo) setMsgs(r); });
    return () => { vivo = false; };
  }, [chamados]);

  if (!chamados.length) return <p className="mob-campo-dica">Nenhum chamado aqui.</p>;

  // Do mais apertado para o mais folgado: na reunião, a primeira linha da lista
  // tem de ser a que precisa de resposta.
  const ordenados = [...chamados].sort((a, b) => (
    String(a.sla_vence_em || '9999').localeCompare(String(b.sla_vence_em || '9999'))
  ));

  return (
    <div className="mob-tabela-scroll">
      <table className="mob-tabela">
        <thead>
          <tr>
            <th className="num">#</th><th>Assunto</th><th>Situação</th>
            <th>Aberto em</th><th>Vence em</th><th>Última mensagem</th>
          </tr>
        </thead>
        <tbody>
          {ordenados.map((c) => {
            const tom = semaforoPrazo(c.sla_vence_em, agora);
            return (
              <tr key={c.id}>
                <td className="num">#{c.numero}</td>
                <td>{c.assunto}</td>
                <td>{STATUS_CHAMADO[c.status] || c.status}</td>
                <td>{dataHora(c.criado_em)}</td>
                <td><span className={`mob-prazo tom-${tom}`}>{dataHora(c.sla_vence_em)}</span></td>
                <td className="tor-det-coment">
                  <CelulaMensagem estado={msgs} msg={msgs?.porId.get(c.id)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Estado comum às duas células: carregando, sem acesso à informação, ou vazio. */
function Aviso({ estado }) {
  if (!estado) return <span className="tor-det-meta"><Loader2 size={12} className="mob-spin" /> carregando…</span>;
  // "Indisponível" e não "nenhum": a informação não veio, o que é diferente de
  // ela não existir — e na reunião essa diferença muda a conversa.
  if (!estado.disponivel) return <span className="tor-det-meta">indisponível no momento</span>;
  return null;
}

const Anexos = ({ n }) => (n > 0 ? (
  <span className="tor-det-meta" title={`${n} arquivo(s) anexado(s)`}>
    <Paperclip size={11} /> {n}
  </span>
) : null);

/**
 * Comentários de um passo: o mais recente à vista, os anteriores recolhidos.
 *
 * Na reunião a pergunta é "qual a situação agora?", e a resposta é o último
 * comentário. O histórico fica a um clique (`details`, nativo: abre por
 * teclado e é lido pelo leitor de tela sem nenhum estado a mais).
 */
function CelulaComentarios({ estado, lista }) {
  const aviso = <Aviso estado={estado} />;
  if (!estado || !estado.disponivel) return aviso;
  if (!lista.length) return <span className="tor-det-meta">—</span>;

  const [ultimo, ...anteriores] = lista;
  return (
    <>
      <Comentario c={ultimo} />
      {anteriores.length > 0 && (
        <details className="tor-det-mais">
          <summary>+ {anteriores.length} anterior{anteriores.length > 1 ? 'es' : ''}</summary>
          {anteriores.map((c, i) => <Comentario key={`${c.created_at}-${i}`} c={c} />)}
        </details>
      )}
    </>
  );
}

function Comentario({ c }) {
  return (
    <div className="tor-det-item">
      {c.texto && <p className="tor-det-txt">{c.texto}</p>}
      <span className="tor-det-meta">
        {c.autorNome || 'Usuário'} · {dataHora(c.created_at)} <Anexos n={c.qtd_anexos} />
      </span>
    </div>
  );
}

/**
 * A última mensagem do chat do chamado. O lado (Solicitante / Adm) vem junto
 * porque é a pergunta seguinte da reunião: "a bola está com quem?".
 */
function CelulaMensagem({ estado, msg }) {
  const aviso = <Aviso estado={estado} />;
  if (!estado || !estado.disponivel) return aviso;
  if (!msg) return <span className="tor-det-meta">sem mensagens</span>;

  return (
    <div className="tor-det-item">
      {msg.mensagem && <p className="tor-det-txt">{msg.mensagem}</p>}
      <span className="tor-det-meta">
        <span className={`tor-det-lado ${msg.do_solicitante ? 'is-solic' : 'is-adm'}`}>
          {msg.do_solicitante ? 'Solicitante' : 'Adm'}
        </span>
        {' '}{msg.autorNome || 'Usuário'} · {dataHora(msg.created_at)} <Anexos n={msg.qtd_anexos} />
      </span>
    </div>
  );
}

function Campo({ rot, val }) {
  return (
    <div className="mob-campo">
      <label>{rot}</label>
      <span style={{ fontSize: 'var(--font-size-sm)' }}>{val || '—'}</span>
    </div>
  );
}
