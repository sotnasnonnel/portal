import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, AlertCircle, Send, Paperclip, FileText, Lock, UserCheck,
  CheckCircle2, RotateCcw, Star, CircleDot,
} from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { getClasse, getServico } from '../../../../config/administrativo';
import { contextoDoChamado } from '../../lib/rotulos';
import { rotuloDoCampo, formatarValorCampo, CAMPOS_OCULTOS } from '../novo/formularios/schemas';
import {
  buscarChamado, listarInteracoes, listarEventos, listarEtapas, responder, marcarLidas,
  assumirChamado, fecharChamado, fecharChamadoComBaixa, reabrirChamado, avaliarChamado, urlDoAnexo,
} from '../../lib/chamados';
import FluxoAprovacao from './FluxoAprovacao';
import BaixaEstoque from './BaixaEstoque';
import { montarLinhaDoTempo, textoDoEvento } from '../../lib/linhaDoTempo';
import {
  chamadoDeEstoque, chamadoUsaEstoque, categoriaDoChamado, montarLinhasDeBaixa, validarLinhasDeBaixa,
  linhasComQuantidade,
} from '../../lib/estoqueDoChamado';
// Consulta e catálogo vêm do módulo de Estoque — dependência de mão única.
import ConsultaEstoque from '../../../estoque/app/components/ConsultaEstoque';
import { listarPosicao, listarPessoasEstoque, movimentosDoChamado } from '../../../estoque/lib/estoque';

// Satisfação de 1 a 5 estrelas. Até 3 exige comentário — é onde mora a
// informação útil de uma pesquisa; o banco também barra.
const ESTRELAS = [1, 2, 3, 4, 5];
const LEGENDA_NOTA = {
  1: 'Muito insatisfeito', 2: 'Insatisfeito', 3: 'Regular',
  4: 'Satisfeito', 5: 'Muito satisfeito',
};
const NOTA_EXIGE_COMENTARIO = (n) => n > 0 && n <= 3;

const ROTULO_STATUS = {
  aguardando_aprovacao: 'Aguardando aprovação', aberto: 'Aberto',
  em_atendimento: 'Em atendimento', aguardando_solicitante: 'Aguardando solicitante',
  fechado: 'Fechado', reprovado: 'Reprovado', cancelado: 'Cancelado',
};

const dataHora = (iso) => (iso
  ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  : '—');

export default function ChamadoAdm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, modules } = useAuth();
  const [chamado, setChamado] = useState(null);
  const [interacoes, setInteracoes] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [nomesEventos, setNomesEventos] = useState({});
  const [etapas, setEtapas] = useState([]);
  const [nomesEtapas, setNomesEtapas] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState('');

  const [mensagem, setMensagem] = useState('');
  const [interna, setInterna] = useState(false);
  const [resolucao, setResolucao] = useState('');
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState('');

  // Baixa de estoque — só existe em EPI e uniforme (ver estoqueDoChamado.js).
  const [linhasBaixa, setLinhasBaixa] = useState([]);
  const [posicaoEst, setPosicaoEst] = useState([]);
  const [pessoasEst, setPessoasEst] = useState([]);
  const [estCarregando, setEstCarregando] = useState(false);
  const [semMovimentar, setSemMovimentar] = useState(false);

  const souAdm = modules?.administrativo === 'admin' || modules?.administrativo === 'atendente';

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const c = await buscarChamado(id);
      if (!c) { setErro('Chamado não encontrado ou sem permissão de acesso.'); return; }
      setChamado(c);
      const [msgs, hist, fluxo] = await Promise.all([
        listarInteracoes(id), listarEventos(id), listarEtapas(id),
      ]);
      setInteracoes(msgs);
      setEventos(hist.eventos);
      setNomesEventos(hist.nomes);
      setEtapas(fluxo.etapas);
      setNomesEtapas(fluxo.nomes);
      marcarLidas(id, { souSolicitante: c.solicitante_id === user?.id });
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [id, user?.id]);

  useEffect(() => { carregar(); }, [carregar]);

  /**
   * SALDO, para o time do Adm — em QUALQUER status do chamado.
   *
   * É o "saber quantos tem" na hora de decidir se fornece, e essa hora costuma
   * ser ANTES de o chamado entrar em andamento (num pedido aguardando
   * aprovação, por exemplo). Por isso a carga do saldo não fica presa à janela
   * de fechamento — só ao serviço ser de EPI/uniforme, o que mantém a promessa
   * de nenhuma query a mais nos outros ~24 serviços do catálogo.
   *
   * Falta de saldo NÃO bloqueia nada: o pedido é aberto do mesmo jeito e o
   * número aqui é informação para quem vai atender.
   */
  useEffect(() => {
    if (!chamado || !chamadoDeEstoque(chamado) || !souAdm) return undefined;
    let cancelado = false;
    listarPosicao()
      .then((pos) => { if (!cancelado) setPosicaoEst(pos); })
      .catch((e) => { if (!cancelado) setErro(`Estoque indisponível: ${e.message}`); });
    return () => { cancelado = true; };
  }, [chamado, souAdm]);

  /**
   * BAIXA: só na janela em que o chamado pode ser fechado, e só para quem pode
   * fechá-lo. É o que alimenta o card de baixa.
   *
   * `movimentosDoChamado` é o que alimenta a coluna "já entregue" — sem ela,
   * fechar de novo depois de uma reabertura baixaria o material em dobro.
   */
  useEffect(() => {
    if (!chamado || !chamadoUsaEstoque(chamado)) return undefined;
    const podeBaixar = (souAdm || chamado.atendente_id === user?.id)
      && ['aberto', 'em_atendimento', 'aguardando_solicitante'].includes(chamado.status);
    if (!podeBaixar) return undefined;

    let cancelado = false;
    setEstCarregando(true);
    (async () => {
      try {
        const [pos, pes, movs] = await Promise.all([
          listarPosicao(), listarPessoasEstoque(), movimentosDoChamado(chamado.id),
        ]);
        if (cancelado) return;
        setPosicaoEst(pos);
        setPessoasEst(pes);
        setLinhasBaixa(montarLinhasDeBaixa({
          campos: chamado.campos, movimentos: movs, posicao: pos,
          solicitanteId: chamado.solicitante_id,
        }));
      } catch (e) {
        // Falhar aqui não pode travar o fechamento: o atendente ainda consegue
        // fechar marcando "sem movimentar o estoque".
        if (!cancelado) setErro(`Estoque indisponível: ${e.message}`);
      } finally {
        if (!cancelado) setEstCarregando(false);
      }
    })();
    return () => { cancelado = true; };
  }, [chamado, souAdm, user?.id]);

  const acao = async (nome, fn) => {
    setOcupado(nome);
    setErro('');
    try {
      await fn();
      await carregar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado('');
    }
  };

  const abrirAnexo = async (path) => {
    try {
      window.open(await urlDoAnexo(path), '_blank', 'noopener');
    } catch (e) {
      setErro(e.message);
    }
  };

  if (carregando) {
    return <div className="adm-page"><div className="adm-vazio"><Loader2 size={20} className="adm-spin" /> Carregando…</div></div>;
  }
  if (!chamado) {
    return (
      <div className="adm-page">
        <button type="button" className="adm-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="adm-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>
      </div>
    );
  }

  const cls = getClasse(chamado.classe);
  const srv = getServico(chamado.classe, chamado.servico);
  // Em classe de serviço único os três textos são o mesmo, e a linha virava
  // "Solicitação de compra · Solicitação de compra".
  const contexto = contextoDoChamado({
    classeLabel: cls?.label, servicoLabel: srv?.label, assunto: chamado.assunto,
  });
  const souSolicitante = chamado.solicitante_id === user?.id;
  const campos = Object.entries(chamado.campos || {})
    .filter(([chave, v]) => !CAMPOS_OCULTOS.has(chave) && v !== '' && v !== null
      && !(Array.isArray(v) && v.length === 0));

  const linhaDoTempo = montarLinhaDoTempo({ eventos, mensagens: interacoes });
  const emAndamento = ['aberto', 'em_atendimento', 'aguardando_solicitante'].includes(chamado.status);
  const podeAssumir = souAdm && chamado.atendente_id !== user?.id && emAndamento;
  const podeFechar = (souAdm || chamado.atendente_id === user?.id) && emAndamento;

  // EPI e uniforme descontam do estoque ao fechar; os demais serviços não têm
  // item nenhum e seguem pelo caminho de sempre (fecharChamado).
  // Ler saldo e escrever baixa seguem separados: são permissões diferentes por
  // natureza, e já precisaram ser desligadas independentemente uma vez.
  const deEstoque = chamadoDeEstoque(chamado);
  const usaEstoque = chamadoUsaEstoque(chamado);
  const itensPedidos = Array.isArray(chamado.campos?.itens) ? chamado.campos.itens : [];
  const vaiBaixar = usaEstoque && !semMovimentar && linhasComQuantidade(linhasBaixa).length > 0;
  const problemaBaixa = usaEstoque && !semMovimentar ? validarLinhasDeBaixa(linhasBaixa) : '';
  const podeReabrir = souSolicitante && chamado.status === 'fechado';
  const precisaAvaliar = souSolicitante && chamado.status === 'fechado' && !chamado.avaliacao;

  return (
    <div className="adm-page adm-page-wide">
      <button type="button" className="adm-back" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Voltar
      </button>

      <div className="adm-form-cab">
        <span className="adm-cat-ico">{cls?.icon ? <cls.icon size={24} /> : null}</span>
        <div>
          <h1>#{chamado.numero} · {chamado.assunto}</h1>
          {contexto && <small>{contexto}</small>}
        </div>
        <span className={`adm-badge tom-${chamado.status}`}>
          {ROTULO_STATUS[chamado.status] || chamado.status}
        </span>
      </div>

      {erro && <div className="adm-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      {/* A avaliação vem antes de tudo: enquanto não for feita, o solicitante
          não consegue abrir nenhum chamado novo (trava do POP 9.1). */}
      {precisaAvaliar && (
        <div className="adm-card adm-avaliar">
          <h2 className="adm-card-tit"><Star size={14} /> Avalie o atendimento</h2>
          <p className="adm-campo-dica">
            Enquanto este chamado não for avaliado, você não consegue abrir novos chamados.
          </p>
          <div className="adm-estrelas" role="radiogroup" aria-label="Nota de 1 a 5">
            {ESTRELAS.map((n) => (
              <button key={n} type="button"
                className={`adm-estrela ${n <= nota ? 'is-on' : ''}`}
                onClick={() => setNota(n)}
                role="radio" aria-checked={nota === n}
                aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'} — ${LEGENDA_NOTA[n]}`}
                title={LEGENDA_NOTA[n]}>
                <Star size={26} />
              </button>
            ))}
            {nota > 0 && <span className="adm-estrelas-legenda">{LEGENDA_NOTA[nota]}</span>}
          </div>
          {NOTA_EXIGE_COMENTARIO(nota) && (
            <div className="adm-campo" style={{ marginTop: 12 }}>
              <label htmlFor="aval-com">Comentário<span className="req">*</span></label>
              <textarea id="aval-com" className="adm-textarea adm-textarea-curto"
                value={comentario} onChange={(e) => setComentario(e.target.value)} />
            </div>
          )}
          <div className="adm-acoes">
            <button type="button" className="adm-btn adm-btn-primary"
              disabled={!nota || ocupado === 'avaliar'}
              onClick={() => acao('avaliar', () => avaliarChamado(chamado.id, nota, comentario))}>
              {ocupado === 'avaliar' ? <Loader2 size={16} className="adm-spin" /> : <Star size={16} />} Enviar avaliação
            </button>
          </div>
        </div>
      )}

      <div className="adm-card">
        <h2 className="adm-card-tit">Dados do chamado</h2>
        <dl className="adm-aprov-campos">
          <div><dt>Solicitante</dt><dd>{chamado.solicitanteNome || '—'}</dd></div>
          <div><dt>Responsável</dt><dd>{chamado.atendenteNome || 'Sem responsável'}</dd></div>
          <div><dt>Criação</dt><dd>{dataHora(chamado.criado_em)}</dd></div>
          <div><dt>Análise</dt><dd>{dataHora(chamado.analise_em)}</dd></div>
          <div><dt>Vencimento SLA</dt><dd>{dataHora(chamado.sla_vence_em)}</dd></div>
          {chamado.fechado_em && <div><dt>Fechamento</dt><dd>{dataHora(chamado.fechado_em)}</dd></div>}
          {campos.map(([chave, valor]) => (
            <div key={chave}>
              <dt>{rotuloDoCampo(chamado.classe, chamado.servico, chave)}</dt>
              <dd>{formatarValorCampo(chamado.classe, chamado.servico, chave, valor)}</dd>
            </div>
          ))}
        </dl>

        {/* Itens do pedido: bloco próprio porque `campos.itens` é um array de
            OBJETOS, e o formatador genérico faria join(', ') nele — sairia
            "[object Object]". Está em CAMPOS_OCULTOS por isso. */}
        {itensPedidos.length > 0 && (
          <div className="adm-campo">
            <label>Itens solicitados</label>
            <div className="adm-tabela-scroll">
              <table className="adm-tabela">
                <thead>
                  <tr>
                    <th className="num">Qtd.</th>
                    <th>Item</th>
                    {souAdm && (
                      <th className="num" title="Saldo atual, comparado com o que foi pedido">
                        Em estoque
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {itensPedidos.map((it, i) => {
                    const v = posicaoEst.find((pp) => pp.id === it.variante_id);
                    const pedido = Number(it.quantidade) || 0;
                    // A pergunta do Adm não é "quanto tem", é "dá para atender".
                    // Por isso a coluna compara o saldo com o que foi pedido.
                    const falta = v ? Math.max(0, pedido - v.saldo) : 0;
                    return (
                      <tr key={`${it.variante_id}-${i}`}>
                        <td className="num">{pedido}</td>
                        <td>
                          {it.descricao}
                          {[it.tamanho, it.ca ? `CA ${it.ca}` : ''].filter(Boolean).length > 0
                            && ` · ${[it.tamanho, it.ca ? `CA ${it.ca}` : ''].filter(Boolean).join(' · ')}`}
                        </td>
                        {souAdm && (
                          <td className={`num ${falta ? 'is-vencido' : ''}`}>
                            {!v ? (
                              // Item que saiu do catálogo (ou nunca esteve nele).
                              <span title="Item não está no catálogo do estoque">—</span>
                            ) : falta ? (
                              <span title={`Faltam ${falta} para atender o pedido`}>
                                {v.saldo} · faltam {falta}
                              </span>
                            ) : (
                              v.saldo
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {chamado.descricao && <p className="adm-aprov-desc">{chamado.descricao}</p>}

        {(chamado.anexos || []).length > 0 && (
          <div className="adm-campo">
            <label>Anexos</label>
            <ul className="adm-anexo-lista">
              {chamado.anexos.map((a) => (
                <li key={a.path} className="adm-anexo-item">
                  <FileText size={16} />
                  <button type="button" className="adm-link" onClick={() => abrirAnexo(a.path)}>{a.nome}</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Avaliação já registrada: fecha o ciclo para quem abre o chamado
            depois e é o dado da pesquisa de satisfação. */}
        {chamado.avaliacao && (
          <div className="adm-campo">
            <label>Avaliação do atendimento</label>
            <div className="adm-estrelas is-leitura">
              {ESTRELAS.map((n) => (
                <span key={n} className={`adm-estrela ${n <= chamado.avaliacao.nota ? 'is-on' : ''}`}>
                  <Star size={18} />
                </span>
              ))}
              <span className="adm-estrelas-legenda">{LEGENDA_NOTA[chamado.avaliacao.nota]}</span>
            </div>
            {chamado.avaliacao.comentario && (
              <p className="adm-aprov-desc">{chamado.avaliacao.comentario}</p>
            )}
          </div>
        )}

        {chamado.resolucao && (
          <>
            <h2 className="adm-card-tit" style={{ marginTop: 18 }}>Resolução</h2>
            <p className="adm-aprov-desc">{chamado.resolucao}</p>
          </>
        )}

        <div className="adm-acoes">
          {podeAssumir && (
            <button type="button" className="adm-btn adm-btn-ghost" disabled={!!ocupado}
              onClick={() => acao('assumir', () => assumirChamado(chamado.id, user.id))}>
              <UserCheck size={16} /> Assumir chamado
            </button>
          )}
          {podeReabrir && (
            <button type="button" className="adm-btn adm-btn-ghost" disabled={!!ocupado}
              onClick={() => acao('reabrir', () => reabrirChamado(chamado.id, chamado.reaberturas))}>
              <RotateCcw size={16} /> Reabrir chamado
            </button>
          )}
        </div>
      </div>

      {/* Saber se TEM o item antes de prometer a entrega, sem trocar de módulo.
          Nasce fechado e só consulta o estoque quando aberto. */}
      {souAdm && deEstoque && (
        <ConsultaEstoque categoria={categoriaDoChamado(chamado)} />
      )}

      {/* Fechar exige escrever a resolução: é o texto que o solicitante lê ao
          avaliar, e o único registro do que foi feito. */}
      {podeFechar && (
        <div className="adm-card">
          <h2 className="adm-card-tit">Fechar chamado</h2>
          <div className="adm-campo">
            <label htmlFor="res">Resolução da solicitação<span className="req">*</span></label>
            <textarea id="res" className="adm-textarea adm-textarea-curto" value={resolucao}
              onChange={(e) => setResolucao(e.target.value)}
              placeholder="O que foi feito para resolver o pedido." />
          </div>

          {/* Só EPI e uniforme: nos outros serviços o card é o mesmo de sempre. */}
          {usaEstoque && (
            <BaixaEstoque
              linhas={linhasBaixa}
              onMudar={setLinhasBaixa}
              posicao={posicaoEst}
              pessoas={pessoasEst}
              categoria={categoriaDoChamado(chamado)}
              carregando={estCarregando}
              semMovimentar={semMovimentar}
              onSemMovimentar={setSemMovimentar}
              desabilitado={ocupado === 'fechar'}
            />
          )}

          {problemaBaixa && (
            <div className="adm-aviso tom-erro"><AlertCircle size={16} /> {problemaBaixa}</div>
          )}

          <div className="adm-acoes">
            <button type="button" className="adm-btn adm-btn-primary"
              disabled={!resolucao.trim() || !!problemaBaixa || ocupado === 'fechar'}
              onClick={() => acao('fechar', () => (
                // Com itens a baixar, fechamento e baixa vão juntos numa
                // transação (RPC). Sem itens, é o caminho de sempre.
                vaiBaixar
                  ? fecharChamadoComBaixa(chamado.id, resolucao, linhasBaixa)
                  : fecharChamado(chamado.id, resolucao)
              ))}>
              {ocupado === 'fechar' ? <Loader2 size={16} className="adm-spin" /> : <CheckCircle2 size={16} />}
              {vaiBaixar ? 'Fechar e baixar estoque' : 'Fechar'}
            </button>
          </div>
        </div>
      )}

      <FluxoAprovacao
        etapas={etapas}
        nomes={nomesEtapas}
        atendenteNome={chamado.atendenteNome}
        status={chamado.status}
        fechadoEm={chamado.fechado_em}
      />

      {/* Mensagens e eventos numa lista só: é o que mostra ao solicitante que o
          pedido andou, mesmo quando ninguém escreveu nada. */}
      <div className="adm-card">
        <h2 className="adm-card-tit">Acompanhamento</h2>
        {linhaDoTempo.length === 0 ? (
          <p className="adm-campo-dica">Nada registrado ainda.</p>
        ) : (
          <ul className="adm-msgs">
            {linhaDoTempo.map((item) => (item.tipo === 'evento' ? (
              <li key={`ev-${item.dado.id}`} className="adm-evento">
                <CircleDot size={14} />
                <span>{textoDoEvento(item.dado, nomesEventos)}</span>
                <time>{dataHora(item.em)}</time>
              </li>
            ) : (
              <li key={item.dado.id} className={`adm-msg ${item.dado.interna ? 'is-interna' : ''}`}>
                <div className="adm-msg-cab">
                  <strong>{item.dado.autorNome || 'Usuário'}</strong>
                  <span>{dataHora(item.dado.created_at)}</span>
                  {item.dado.interna && <span className="adm-msg-tag"><Lock size={11} /> Nota interna</span>}
                </div>
                <p>{item.dado.mensagem}</p>
                {(item.dado.anexos || []).length > 0 && (
                  <ul className="adm-anexo-lista">
                    {item.dado.anexos.map((a) => (
                      <li key={a.path} className="adm-anexo-item">
                        <Paperclip size={14} />
                        <button type="button" className="adm-link" onClick={() => abrirAnexo(a.path)}>{a.nome}</button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )))}
          </ul>
        )}

        <div className="adm-campo" style={{ marginTop: 14 }}>
          <label htmlFor="msg">Escreva sua mensagem</label>
          <textarea id="msg" className="adm-textarea adm-textarea-curto" value={mensagem}
            onChange={(e) => setMensagem(e.target.value)} />
          {souAdm && (
            <label className="adm-check" style={{ marginTop: 8 }}>
              <input type="checkbox" checked={interna} onChange={(e) => setInterna(e.target.checked)} />
              Nota interna (o solicitante não vê)
            </label>
          )}
        </div>
        <div className="adm-acoes">
          <button type="button" className="adm-btn adm-btn-primary"
            disabled={!mensagem.trim() || ocupado === 'msg'}
            onClick={() => acao('msg', async () => {
              // Responder passa a bola: o Adm joga para "aguardando solicitante"
              // e o solicitante devolve para "em atendimento".
              await responder({
                chamado, autorId: user.id, mensagem, interna, souSolicitante,
              });
              setMensagem('');
              setInterna(false);
            })}>
            {ocupado === 'msg' ? <Loader2 size={16} className="adm-spin" /> : <Send size={16} />} Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
