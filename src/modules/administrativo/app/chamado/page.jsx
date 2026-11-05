import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Loader2, AlertCircle, FileText, UserCheck,
  CheckCircle2, RotateCcw, Star, Users, X, Ban, Workflow, ClipboardCheck, Check,
  CalendarOff,
} from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { useMediaQuery } from '../../../../hooks/useMediaQuery';
import { getClasse, getServico, podeReatribuirAdm, souTimeDaClasse } from '../../../../config/administrativo';
import { contextoDoChamado } from '../../lib/rotulos';
import {
  rotuloDoCampo, formatarValorCampo, CAMPOS_OCULTOS, chavesDePessoa,
} from '../novo/formularios/schemas';
import {
  buscarChamado, listarInteracoes, listarEventos, listarEtapas, marcarLidas,
  assumirChamado, fecharChamado, fecharChamadoComBaixa, reabrirChamado, avaliarChamado, urlDoAnexo,
  listarTimeAdm, definirResponsavel, cancelarChamado, decidirChamado, liberarSemAprovacao,
} from '../../lib/chamados';
import FluxoAprovacao from './FluxoAprovacao';
import BaixaEstoque from './BaixaEstoque';
import Conversa from './Conversa';
import { Carregando, PrazoSla, StatusBadge } from '../components/ui';
import { montarLinhaDoTempo } from '../../lib/linhaDoTempo';
import {
  camposVisiveis, ehIdCru, nomeDoCampoPessoa, situacaoDoChamado,
} from '../../lib/situacaoChamado';
import { ehEncerrado, etapaQueEsperaPorMim } from '../../lib/statusChamado';
import { prazoAdiado } from '../../lib/prazo';
import { perguntaParaQuem } from '../../lib/paraQuem';
import { descreverAusencia, ausenteNoDia, diaLocalIso } from '../../../../utils/ausenciaColaborador';
import {
  chamadoDeEstoque, chamadoUsaEstoque, categoriaDoChamado, montarLinhasDeBaixa, validarLinhasDeBaixa,
  linhasComQuantidade,
} from '../../lib/estoqueDoChamado';
// O processo de mobilização que este chamado abriu. Só LEITURA, e a
// dependência é de mão única, como a do Estoque: o Atendimento importa do
// módulo mais novo, nunca o contrário.
import { processoDoChamado } from '../../../mobilizacao/lib/mobilizacao';
import EtapasDoProcesso from './EtapasDoProcesso';
// Consulta e catálogo vêm do módulo de Estoque — dependência de mão única.
import ConsultaEstoque from '../../../estoque/app/components/ConsultaEstoque';
import { listarPosicao, listarPessoasEstoque, movimentosDoChamado } from '../../../estoque/lib/estoque';
import { formatarDataHora } from '../../../../utils/formatters';

// Satisfação de 1 a 5 estrelas. Até 3 exige comentário — é onde mora a
// informação útil de uma pesquisa; o banco também barra.
const ESTRELAS = [1, 2, 3, 4, 5];
const LEGENDA_NOTA = {
  1: 'Muito insatisfeito', 2: 'Insatisfeito', 3: 'Regular',
  4: 'Satisfeito', 5: 'Muito satisfeito',
};
const NOTA_EXIGE_COMENTARIO = (n) => n > 0 && n <= 3;

// A Mobilização guarda prazo como DATA pura ('AAAA-MM-DD'), sem hora. Passar
// isso por new Date() a leria como UTC e, no nosso fuso, mostraria o dia
// anterior — o mesmo erro que dataHora evita por já receber timestamp.
const dataDia = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');

const dataHora = (iso) => formatarDataHora(iso, '—');

// A mesma largura da regra de duas colunas de .adm-ch-grade no CSS. Precisa ser
// conhecida aqui porque as ações mudam de lugar na ÁRVORE: reordenar só com CSS
// deixaria a ordem do teclado diferente da ordem que se vê no celular.
const DUAS_COLUNAS = '(min-width: 1180px)';

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
  const [processoMob, setProcessoMob] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState('');
  const [justificativa, setJustificativa] = useState('');

  // Troca de responsável: só coordenação usa, então o time só é buscado
  // quando o painel abre — quem nunca clica não paga a consulta.
  const [trocando, setTrocando] = useState(false);
  const [timeAdm, setTimeAdm] = useState([]);
  const [novoResponsavel, setNovoResponsavel] = useState('');

  const [fechando, setFechando] = useState(false);
  const [resolucao, setResolucao] = useState('');
  // Cancelamento: pedido que não vai ser atendido, diferente de resolvido.
  // Nasce fechado para não competir com o fechamento normal, que é o caminho
  // de todos os dias.
  const [cancelando, setCancelando] = useState(false);
  const [motivoCancelo, setMotivoCancelo] = useState('');
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState('');

  // Baixa de estoque — só existe em EPI e uniforme (ver estoqueDoChamado.js).
  const [linhasBaixa, setLinhasBaixa] = useState([]);
  const [posicaoEst, setPosicaoEst] = useState([]);
  const [pessoasEst, setPessoasEst] = useState([]);
  const [estCarregando, setEstCarregando] = useState(false);
  const [semMovimentar, setSemMovimentar] = useState(false);

  const [verTodosCampos, setVerTodosCampos] = useState(false);
  const duasColunas = useMediaQuery(DUAS_COLUNAS);
  const btnFecharRef = useRef(null);
  const btnTrocarRef = useRef(null);
  const btnCancelarRef = useRef(null);
  const painelFecharRef = useRef(null);
  const resolucaoRef = useRef(null);
  const motivoCanceloRef = useRef(null);
  const novoRespRef = useRef(null);
  const justificativaRef = useRef(null);

  // "Time" depende do chamado: o de DP é atendido pelo DP, não pelo Adm.
  const souAdm = chamado ? souTimeDaClasse(chamado.classe, { user, modules }) : false;

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const c = await buscarChamado(id);
      if (!c) { setChamado(null); setErro('Chamado não encontrado ou sem permissão de acesso.'); return; }
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

  // Processo de mobilização nascido deste chamado. Silencioso de propósito: a
  // ausência é o caso normal (todo chamado que não é de mobilização), e uma
  // falha aqui não pode atrapalhar a tela do chamado.
  useEffect(() => {
    if (!chamado || chamado.classe !== 'mobilizacao') { setProcessoMob(null); return undefined; }
    let cancelado = false;
    processoDoChamado(chamado.id).then((p) => { if (!cancelado) setProcessoMob(p); });
    return () => { cancelado = true; };
  }, [chamado]);

  // Time do Adm para o seletor de responsável. Buscado só quando o painel de
  // troca abre: é ação de coordenação, usada por duas pessoas.
  useEffect(() => {
    if (!trocando || timeAdm.length) return undefined;
    let cancelado = false;
    listarTimeAdm()
      .then((t) => { if (!cancelado) setTimeAdm(t); })
      .catch((e) => { if (!cancelado) setErro(e.message); });
    return () => { cancelado = true; };
  }, [trocando, timeAdm.length]);

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

  // Abrir um painel leva o foco para o campo dele; quem usa teclado ou leitor de
  // tela não precisa procurar o que acabou de abrir. O de fechar pode estar fora
  // da tela, porque o botão fica fixo ao lado e o painel, no topo da coluna.
  useEffect(() => {
    if (!fechando) return;
    painelFecharRef.current?.scrollIntoView({ block: 'nearest' });
    resolucaoRef.current?.focus({ preventScroll: true });
  }, [fechando]);
  useEffect(() => { if (cancelando) motivoCanceloRef.current?.focus(); }, [cancelando]);
  // O seletor nasce desabilitado até o time chegar, e campo desabilitado não
  // recebe foco: por isso depende também do tamanho da lista.
  useEffect(() => { if (trocando) novoRespRef.current?.focus(); }, [trocando, timeAdm.length]);

  // A etapa que espera a decisão de quem está olhando (regra em lib/statusChamado).
  const minhaEtapa = chamado
    ? etapaQueEsperaPorMim(etapas, user?.id, chamado.status)
    : null;

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

  // Sem histórico (chegou pelo link do e-mail, em aba nova), "voltar" não iria a
  // lugar nenhum.
  const voltar = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/administrativo/meus');
  };

  // Só a primeira carga troca a tela pelo aviso. Cada ação recarrega o chamado, e
  // desmontar tudo a cada resposta levava a rolagem e o foco de quem estava lendo.
  if (carregando && chamado?.id !== id) {
    return <div className="adm-page"><Carregando /></div>;
  }
  if (!chamado) {
    return (
      <div className="adm-page">
        <button type="button" className="adm-back" onClick={voltar}>
          <ArrowLeft size={16} aria-hidden="true" /> Voltar
        </button>
        <div className="adm-aviso tom-erro" role="alert"><AlertCircle size={16} aria-hidden="true" /> {erro}</div>
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
  const encerrado = ehEncerrado(chamado.status);
  const podeTrocarResponsavel = podeReatribuirAdm(user) && !encerrado;
  const chavesPessoa = new Set(chavesDePessoa(chamado.classe, chamado.servico));
  const emAndamento = ['aberto', 'em_atendimento', 'aguardando_solicitante'].includes(chamado.status);
  const podeAssumir = souAdm && chamado.atendente_id !== user?.id && emAndamento;
  const podeFechar = (souAdm || chamado.atendente_id === user?.id) && emAndamento;
  // Quem pode fechar pode cancelar: as duas encerram o chamado, e é o time do
  // Adm que recebe o pedido de cancelamento do solicitante.
  const podeCancelar = podeFechar;

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
  // Folga de Campo / Ausência Programada da pessoa do chamado, entre a
  // abertura e o fechamento. Nos serviços que já perguntam a pessoa (a
  // mobilização, por exemplo) o nome dela já está nos campos abaixo.
  const ausencias = chamado.ausencias || [];
  const nomeColaborador = chamado.colaboradorNome || 'O colaborador';
  const mostraParaQuem = chamado.colaborador_id && perguntaParaQuem(chamado.classe, chamado.servico);
  // Quem adiou o prazo: o colaborador, se estava fora quando o chamado entrou
  // na fila; senão, o responsável (a regra mais antiga).
  const colaboradorAdiou = ausenteNoDia(
    ausencias, diaLocalIso(chamado.analise_em || chamado.criado_em),
  );
  const precisaAvaliar = souSolicitante && chamado.status === 'fechado' && !chamado.avaliacao;
  const agora = Date.now();

  const { comQuem, passo } = situacaoDoChamado({
    status: chamado.status,
    meuId: user?.id,
    souSolicitante,
    souTime: souAdm,
    atendenteId: chamado.atendente_id,
    atendenteNome: chamado.atendenteNome,
    solicitanteNome: chamado.solicitanteNome,
    etapas,
    nomesEtapas,
    minhaEtapa,
    temAvaliacao: !!chamado.avaliacao,
    precisaAvaliar,
    podeAssumir,
    podeReabrir,
  });

  const qtdCampos = camposVisiveis(campos.length, { expandido: verTodosCampos, vaiDecidir: !!minhaEtapa });
  const temPedido = chamado.descricao || campos.length > 0 || itensPedidos.length > 0
    || (chamado.anexos || []).length > 0;
  const temResultado = chamado.resolucao || chamado.avaliacao;
  const temAcoes = podeAssumir || podeFechar || podeTrocarResponsavel || podeReabrir || podeCancelar;
  // Sem responsável, o primeiro passo é pegar o chamado; com responsável, é resolvê-lo.
  const assumirEhPrincipal = podeAssumir && !chamado.atendente_id;

  const btnAssumir = podeAssumir && (
    <button type="button" className={`adm-btn ${assumirEhPrincipal ? 'adm-btn-primary' : 'adm-btn-ghost'}`}
      disabled={!!ocupado}
      onClick={() => acao('assumir', () => assumirChamado(chamado.id, user.id))}>
      {ocupado === 'assumir'
        ? <Loader2 size={16} className="adm-spin" aria-hidden="true" />
        : <UserCheck size={16} aria-hidden="true" />} Assumir chamado
    </button>
  );
  const btnFechar = podeFechar && (
    <button type="button" ref={btnFecharRef}
      className={`adm-btn ${assumirEhPrincipal ? 'adm-btn-ghost' : 'adm-btn-primary'}`}
      aria-expanded={fechando} aria-controls="adm-ch-fechar"
      onClick={() => setFechando((v) => !v)}>
      <CheckCircle2 size={16} aria-hidden="true" /> Fechar chamado
    </button>
  );

  // Fechar exige escrever a resolução: é o texto que o solicitante lê ao avaliar, e
  // o único registro do que foi feito. Nasce fechado porque a maioria das visitas
  // é para responder, e aberto ele empurrava a conversa para fora da tela. Com
  // baixa de estoque ocupa a largura toda: as oito colunas da tabela não cabem ao
  // lado do resumo.
  const painelFechar = podeFechar && fechando && (
    <section className="adm-card adm-ch-painel" id="adm-ch-fechar" ref={painelFecharRef}
      aria-labelledby="adm-ch-fechar-tit">
      <h2 className="adm-card-tit" id="adm-ch-fechar-tit">Fechar chamado</h2>
      <div className="adm-campo">
        <label htmlFor="res">Resolução da solicitação<span className="req">*</span></label>
        <textarea id="res" ref={resolucaoRef} className="adm-textarea adm-textarea-curto" value={resolucao}
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
        <div className="adm-aviso tom-erro"><AlertCircle size={16} aria-hidden="true" /> {problemaBaixa}</div>
      )}

      <div className="adm-acoes">
        <button type="button" className="adm-btn adm-btn-primary"
          disabled={!resolucao.trim() || !!problemaBaixa || ocupado === 'fechar'}
          onClick={() => acao('fechar', async () => {
            // Com itens a baixar, fechamento e baixa vão juntos numa
            // transação (RPC). Sem itens, é o caminho de sempre.
            if (vaiBaixar) await fecharChamadoComBaixa(chamado.id, resolucao, linhasBaixa);
            else await fecharChamado(chamado.id, resolucao);
            setFechando(false);
            setResolucao('');
          })}>
          {ocupado === 'fechar'
            ? <Loader2 size={16} className="adm-spin" aria-hidden="true" />
            : <CheckCircle2 size={16} aria-hidden="true" />}
          {vaiBaixar ? 'Fechar e baixar estoque' : 'Confirmar fechamento'}
        </button>
        {/* Voltar guarda o texto: quem foi conferir algo na conversa não
            perde o que já escreveu. */}
        <button type="button" className="adm-btn adm-btn-ghost" disabled={ocupado === 'fechar'}
          onClick={() => { setFechando(false); btnFecharRef.current?.focus(); }}>
          <X size={16} aria-hidden="true" /> Voltar
        </button>
      </div>
    </section>
  );

  /* Tudo o que muda o chamado num lugar só. Dois painéis abrem aqui mesmo, para a
     mudança acontecer onde se decide por ela; o de fechar precisa de largura para
     a baixa de estoque e abre na coluna principal. */
  const acoes = temAcoes && (
    <section className="adm-card adm-ch-acoes" aria-labelledby="adm-ch-acoes-tit">
      <h2 className="adm-card-tit" id="adm-ch-acoes-tit">Ações</h2>
      <div className="adm-ch-acoes-lista">
        {assumirEhPrincipal ? btnAssumir : btnFechar}
        {assumirEhPrincipal ? btnFechar : btnAssumir}
        {/* Assumir é pegar para si; isto é colocar no nome de outra pessoa,
            para quando o responsável não registrou que pegou o chamado. */}
        {podeTrocarResponsavel && (
          <button type="button" ref={btnTrocarRef} className="adm-btn adm-btn-ghost" disabled={!!ocupado}
            aria-expanded={trocando} aria-controls="adm-ch-trocar"
            onClick={() => {
              if (!trocando) setNovoResponsavel(chamado.atendente_id || '');
              setTrocando(!trocando);
            }}>
            <Users size={16} aria-hidden="true" /> Alterar responsável
          </button>
        )}
        {podeReabrir && (
          <button type="button" className="adm-btn adm-btn-ghost" disabled={!!ocupado}
            onClick={() => acao('reabrir', () => reabrirChamado(chamado.id, chamado.reaberturas))}>
            {ocupado === 'reabrir'
              ? <Loader2 size={16} className="adm-spin" aria-hidden="true" />
              : <RotateCcw size={16} aria-hidden="true" />} Reabrir chamado
          </button>
        )}
        {/* O solicitante pede o cancelamento pela conversa; sem este botão o
            chamado ficava aberto para sempre, ou era fechado como se tivesse
            sido atendido — o que sujaria o indicador de prazo. */}
        {podeCancelar && (
          <button type="button" ref={btnCancelarRef} className="adm-btn adm-btn-recusa" disabled={!!ocupado}
            aria-expanded={cancelando} aria-controls="adm-ch-cancelar"
            onClick={() => setCancelando(!cancelando)}>
            <Ban size={16} aria-hidden="true" /> Cancelar chamado
          </button>
        )}
      </div>

      {podeReabrir && (
        <p className="adm-campo-dica adm-ch-acoes-dica">O problema voltou? Você pode reabrir este chamado.</p>
      )}

      {podeCancelar && cancelando && (
        <div className="adm-trocar-resp" id="adm-ch-cancelar">
          <label htmlFor="adm-motivo-cancelo">
            Motivo do cancelamento<span className="req">*</span>
          </label>
          <textarea
            id="adm-motivo-cancelo"
            ref={motivoCanceloRef}
            className="adm-textarea adm-textarea-curto"
            value={motivoCancelo}
            onChange={(e) => setMotivoCancelo(e.target.value)}
            placeholder="Por que o pedido não vai ser atendido. Ex.: solicitante pediu o cancelamento, aberto em duplicidade."
            disabled={!!ocupado}
          />
          <div className="adm-linha">
            <button
              type="button"
              className="adm-btn adm-btn-recusa"
              disabled={!motivoCancelo.trim() || !!ocupado}
              onClick={() => acao('cancelar', async () => {
                await cancelarChamado(chamado.id, motivoCancelo);
                setCancelando(false);
                setMotivoCancelo('');
              })}
            >
              {ocupado === 'cancelar'
                ? <Loader2 size={16} className="adm-spin" aria-hidden="true" />
                : <Ban size={16} aria-hidden="true" />} Confirmar cancelamento
            </button>
            <button type="button" className="adm-btn adm-btn-ghost" disabled={!!ocupado}
              onClick={() => { setCancelando(false); setMotivoCancelo(''); btnCancelarRef.current?.focus(); }}>
              <X size={16} aria-hidden="true" /> Voltar
            </button>
          </div>
          {/* Cancelar não é resolver: o chamado sai da fila sem entrar na
              conta de prazo cumprido, e não pede avaliação ao solicitante. */}
          <span className="adm-campo-dica">
            O solicitante é avisado por e-mail e o motivo fica no chamado.
            Cancelado não conta como atendido nos indicadores.
          </span>
        </div>
      )}

      {podeTrocarResponsavel && trocando && (
        <div className="adm-trocar-resp" id="adm-ch-trocar">
          <label htmlFor="adm-novo-resp">Responsável pelo atendimento</label>
          <div className="adm-linha">
            <select
              id="adm-novo-resp"
              ref={novoRespRef}
              className="adm-select"
              value={novoResponsavel}
              onChange={(e) => setNovoResponsavel(e.target.value)}
              disabled={!timeAdm.length || !!ocupado}
            >
              {/* Sem responsável é opção legítima: devolve o chamado à fila
                  para quem estiver livre assumir. */}
              <option value="">— Sem responsável —</option>
              {timeAdm.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              disabled={!!ocupado || novoResponsavel === (chamado.atendente_id || '')}
              onClick={() => acao('reatribuir', async () => {
                await definirResponsavel(chamado.id, novoResponsavel);
                setTrocando(false);
              })}
            >
              {ocupado === 'reatribuir'
                ? <Loader2 size={16} className="adm-spin" aria-hidden="true" />
                : <CheckCircle2 size={16} aria-hidden="true" />} Salvar
            </button>
            {/* "Voltar", e não "Cancelar": ao lado de "Cancelar chamado", a mesma
                palavra parecia encerrar o pedido. */}
            <button type="button" className="adm-btn adm-btn-ghost" disabled={!!ocupado}
              onClick={() => { setTrocando(false); btnTrocarRef.current?.focus(); }}>
              <X size={16} aria-hidden="true" /> Voltar
            </button>
          </div>
          <span className="adm-campo-dica">
            {timeAdm.length
              ? 'A troca fica registrada no histórico do chamado.'
              : 'Carregando o time do Atendimento…'}
          </span>
        </div>
      )}
    </section>
  );

  return (
    <div className="adm-page adm-page-wide adm-ch">
      <button type="button" className="adm-back" onClick={voltar}>
        <ArrowLeft size={16} aria-hidden="true" /> Voltar
      </button>

      <div className="adm-form-cab">
        <span className="adm-cat-ico">{cls?.icon ? <cls.icon size={24} aria-hidden="true" /> : null}</span>
        <div>
          <h1>#{chamado.numero} · {chamado.assunto}</h1>
          {contexto && <small>{contexto}</small>}
        </div>
      </div>

      {/* A resposta da pessoa pode falhar longe do topo da página, com a conversa
          rolada; preso sob o cabeçalho, o erro é lido onde quer que ela esteja. */}
      {erro && (
        <div className="adm-aviso tom-erro adm-ch-erro" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{erro}</span>
          <button type="button" className="adm-anexo-x" onClick={() => setErro('')} aria-label="Dispensar aviso">
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* O que a pessoa precisa saber antes de ler qualquer outra coisa. */}
      <dl className="adm-ch-faixa" aria-label="Situação do chamado">
        <div>
          <dt>Status</dt>
          <dd><StatusBadge status={chamado.status} /></dd>
        </div>
        {comQuem && (
          <div>
            <dt>Com quem está</dt>
            <dd>{comQuem}</dd>
          </div>
        )}
        <div>
          <dt>Prazo</dt>
          <dd>
            {/* Sem esta frase, um pedido em aprovação parece não ter prazo nenhum,
                quando o relógio só não começou. */}
            {!chamado.sla_vence_em && chamado.status === 'aguardando_aprovacao'
              ? <span className="adm-prazo-txt tom-sem-prazo">Conta depois da aprovação</span>
              : <PrazoSla venceEm={chamado.sla_vence_em} encerrado={encerrado} agora={agora} />}
          </dd>
        </div>
        <div className={`adm-ch-passo ${passo.suaVez ? 'is-sua-vez' : ''}`}>
          <dt>{passo.suaVez ? 'Sua vez' : 'Próximo passo'}</dt>
          <dd>{passo.texto}</dd>
        </div>
      </dl>

      {ausencias.length > 0 && (
        <div className="adm-aviso tom-info">
          <CalendarOff size={16} aria-hidden="true" />
          <span>
            <strong>{nomeColaborador}</strong> tem ausência registrada durante este chamado:
            {' '}{ausencias.map(descreverAusencia).join('; ')}.
          </span>
        </div>
      )}

      {usaEstoque && painelFechar}

      <div className="adm-ch-grade">
        {!duasColunas && !precisaAvaliar && acoes}

        <div className="adm-ch-principal">
          {/* A avaliação vem antes de tudo: enquanto não for feita, o solicitante
              não consegue abrir nenhum chamado novo (trava do POP 9.1). */}
          {precisaAvaliar && (
            <div className="adm-card adm-avaliar">
              <h2 className="adm-card-tit"><Star size={14} aria-hidden="true" /> Avalie o atendimento</h2>
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
                    <Star size={26} aria-hidden="true" />
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
                  {ocupado === 'avaliar'
                    ? <Loader2 size={16} className="adm-spin" aria-hidden="true" />
                    : <Star size={16} aria-hidden="true" />} Enviar avaliação
                </button>
              </div>
            </div>
          )}
          {!duasColunas && precisaAvaliar && acoes}

          {/* Estado impossível: esperando aprovação sem ninguém para aprovar. Nasce
              de uma abertura que gravou o chamado e não a cadeia. O aviso é para o
              time do Atendimento porque é ele quem fica com o pedido parado na mão
              — o solicitante não teria o que fazer com a informação. */}
          {souAdm && chamado.status === 'aguardando_aprovacao' && !etapas.length && (
            <div className="adm-card">
              <h2 className="adm-card-tit"><AlertCircle size={14} aria-hidden="true" /> Sem cadeia de aprovação</h2>
              <p className="adm-campo-dica">
                Este chamado está esperando aprovação, mas nenhum aprovador foi registrado na
                abertura — então ninguém consegue aprová-lo. Liberar manda o chamado direto para o
                atendimento, com o prazo começando agora.
              </p>
              <div className="adm-acoes">
                <button type="button" className="adm-btn adm-btn-primary" disabled={!!ocupado}
                  onClick={() => acao('liberar', () => liberarSemAprovacao(chamado.id))}>
                  {ocupado === 'liberar'
                    ? <Loader2 size={16} className="adm-spin" aria-hidden="true" />
                    : <Check size={16} aria-hidden="true" />}
                  {' '}Liberar para atendimento
                </button>
              </div>
            </div>
          )}

          {!usaEstoque && painelFechar}

          {temResultado && (
            <div className="adm-card adm-ch-resultado">
              {chamado.resolucao && (
                <>
                  {/* Mesmo campo, dois significados: o que foi feito, ou por que o
                      pedido não vai ser atendido. Chamar de "Resolução" num chamado
                      cancelado diria o contrário do que aconteceu. */}
                  <h2 className="adm-card-tit">
                    {chamado.status === 'cancelado' ? 'Motivo do cancelamento' : 'Resolução'}
                  </h2>
                  <p className="adm-aprov-desc">{chamado.resolucao}</p>
                </>
              )}

              {/* Avaliação já registrada: fecha o ciclo para quem abre o chamado
                  depois e é o dado da pesquisa de satisfação. */}
              {chamado.avaliacao && (
                <>
                  <h2 className="adm-card-tit">Avaliação do atendimento</h2>
                  <div className="adm-estrelas is-leitura" role="img"
                    aria-label={`Nota ${chamado.avaliacao.nota} de 5: ${LEGENDA_NOTA[chamado.avaliacao.nota]}`}>
                    {ESTRELAS.map((n) => (
                      <span key={n} className={`adm-estrela ${n <= chamado.avaliacao.nota ? 'is-on' : ''}`}>
                        <Star size={18} aria-hidden="true" />
                      </span>
                    ))}
                    <span className="adm-estrelas-legenda">{LEGENDA_NOTA[chamado.avaliacao.nota]}</span>
                  </div>
                  {chamado.avaliacao.comentario && (
                    <p className="adm-aprov-desc">{chamado.avaliacao.comentario}</p>
                  )}
                </>
              )}
            </div>
          )}

          {temPedido && (
            <section className="adm-card adm-ch-pedido" aria-labelledby="adm-ch-pedido-tit">
              <h2 className="adm-card-tit" id="adm-ch-pedido-tit">Pedido</h2>
              {chamado.descricao && <p className="adm-aprov-desc">{chamado.descricao}</p>}

              {campos.length > 0 && (
                <dl className="adm-aprov-campos">
                  {campos.slice(0, qtdCampos).map(([chave, valor]) => (
                    <div key={chave} className={String(valor).length > 60 ? 'is-longo' : undefined}>
                      <dt>{rotuloDoCampo(chamado.classe, chamado.servico, chave)}</dt>
                      {/* Campo de pessoa guarda o id; o nome vem resolvido do banco. */}
                      <dd>
                        {chavesPessoa.has(chave) || ehIdCru(valor)
                          ? nomeDoCampoPessoa(valor, chamado.nomesDosCampos)
                          : formatarValorCampo(chamado.classe, chamado.servico, chave, valor)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {qtdCampos < campos.length && (
                <button type="button" className="adm-link adm-ch-ver-mais" onClick={() => setVerTodosCampos(true)}>
                  Ver mais {campos.length - qtdCampos} {campos.length - qtdCampos === 1 ? 'dado' : 'dados'}
                </button>
              )}

              {/* Itens do pedido: bloco próprio porque `campos.itens` é um array de
                  OBJETOS, e o formatador genérico faria join(', ') nele — sairia
                  "[object Object]". Está em CAMPOS_OCULTOS por isso. */}
              {itensPedidos.length > 0 && (
                <div className="adm-campo">
                  <span className="adm-campo-rotulo">Itens solicitados</span>
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

              {(chamado.anexos || []).length > 0 && (
                <div className="adm-campo">
                  <span className="adm-campo-rotulo">Anexos</span>
                  <ul className="adm-anexo-lista">
                    {chamado.anexos.map((a) => (
                      <li key={a.path} className="adm-anexo-item">
                        <FileText size={16} aria-hidden="true" />
                        <button type="button" className="adm-link" onClick={() => abrirAnexo(a.path)}>{a.nome}</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* A decisão mora AQUI, e não só na fila de Aprovações: o aviso do sino
              leva o aprovador ao chamado, e quem chegava por este caminho via a
              própria etapa pendente sem nenhum botão para decidir. Vem depois do
              pedido porque só se decide depois de ler. */}
          {minhaEtapa && (
            <div className="adm-card adm-avaliar">
              <h2 className="adm-card-tit"><ClipboardCheck size={14} aria-hidden="true" /> Sua aprovação</h2>
              <p className="adm-campo-dica">
                Este chamado está esperando a sua decisão. Reprovar exige o motivo, que vai para quem
                abriu.
              </p>
              <label htmlFor="adm-ch-just" className="adm-ch-sr">Observação</label>
              <textarea
                id="adm-ch-just"
                ref={justificativaRef}
                className="adm-textarea adm-textarea-curto"
                placeholder="Observação (obrigatória para reprovar)"
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
              />
              <div className="adm-acoes" style={{ marginTop: 10 }}>
                <button type="button" className="adm-btn adm-btn-primary" disabled={!!ocupado}
                  onClick={() => acao('aprovar', () => decidirChamado({
                    chamadoId: chamado.id, etapaId: minhaEtapa.id, aprovar: true, justificativa,
                  }))}>
                  {ocupado === 'aprovar'
                    ? <Loader2 size={16} className="adm-spin" aria-hidden="true" />
                    : <Check size={16} aria-hidden="true" />} Aprovar
                </button>
                <button type="button" className="adm-btn adm-btn-recusa" disabled={!!ocupado}
                  onClick={() => {
                    if (!justificativa.trim()) {
                      setErro('Explique o motivo para reprovar.');
                      justificativaRef.current?.focus();
                      return;
                    }
                    acao('reprovar', () => decidirChamado({
                      chamadoId: chamado.id, etapaId: minhaEtapa.id, aprovar: false, justificativa,
                    }));
                  }}>
                  {ocupado === 'reprovar'
                    ? <Loader2 size={16} className="adm-spin" aria-hidden="true" />
                    : <X size={16} aria-hidden="true" />} Reprovar
                </button>
              </div>
            </div>
          )}

          {/* Saber se TEM o item antes de prometer a entrega, sem trocar de módulo.
              Nasce fechado e só consulta o estoque quando aberto. */}
          {souAdm && deEstoque && (
            <ConsultaEstoque categoria={categoriaDoChamado(chamado)} />
          )}

          <Conversa
            chamado={chamado}
            linhaDoTempo={linhaDoTempo}
            nomesEventos={nomesEventos}
            meuId={user?.id}
            souAdm={souAdm}
            souSolicitante={souSolicitante}
            ocupado={ocupado}
            acao={acao}
            abrirAnexo={abrirAnexo}
          />

          {/* O que aconteceu DEPOIS do chamado. Quem abre uma mobilização quer
              saber em que passo ela está, e sem isto o chamado morre em si mesmo —
              era exatamente o buraco que a planilha preenchia à mão. Fica depois da
              conversa porque os passos ocupam muita altura; o resumo ao lado leva
              direto ao processo. */}
          {processoMob && (
            <div className="adm-card">
              <h2 className="adm-card-tit"><Workflow size={14} aria-hidden="true" /> Processo de mobilização</h2>
              <p style={{ margin: 0, fontSize: 'var(--font-size-sm)' }}>
                <Link to={`/mobilizacao/processo/${processoMob.id}`}>
                  Processo #{processoMob.numero}
                </Link>
                {' — '}
                {processoMob.etapas_concluidas} de {processoMob.etapas_total} passos concluídos
                {processoMob.prazo_em && `, previsto para ${dataDia(processoMob.prazo_em)}`}.
              </p>
              {/* As etapas e os comentários do processo, para não escrever nos dois lugares. */}
              <EtapasDoProcesso processoId={processoMob.id} />
            </div>
          )}
        </div>

        <aside className="adm-ch-lado" aria-label="Resumo do chamado">
          {duasColunas && acoes}

          <div className="adm-card">
            <h2 className="adm-card-tit">Resumo</h2>
            <dl className="adm-ch-resumo">
              <div><dt>Solicitante</dt><dd>{chamado.solicitanteNome || '—'}</dd></div>
              {mostraParaQuem && (
                <div><dt>Para</dt><dd>{chamado.colaboradorNome || '—'}</dd></div>
              )}
              <div><dt>Responsável</dt><dd>{chamado.atendenteNome || 'Sem responsável'}</dd></div>
              <div><dt>Criação</dt><dd>{dataHora(chamado.criado_em)}</dd></div>
              <div><dt>Análise</dt><dd>{dataHora(chamado.analise_em)}</dd></div>
              {/* Só aparece quando o relógio começou depois da fila — o responsável
                  estava ausente. Sem esta linha, um chamado aberto hoje e vencendo
                  em três semanas parece conta errada. */}
              {prazoAdiado(chamado) && (
                <div>
                  <dt>Início do prazo</dt>
                  <dd>
                    {dataHora(chamado.sla_inicio_em)}
                    <span className="adm-campo-dica" style={{ display: 'block', margin: 0 }}>
                      {colaboradorAdiou ? nomeColaborador : (chamado.atendenteNome || 'O responsável')}
                      {' '}estava ausente na abertura; o prazo conta a partir da volta.
                    </span>
                  </dd>
                </div>
              )}
              <div><dt>Vencimento</dt><dd>{dataHora(chamado.sla_vence_em)}</dd></div>
              {chamado.fechado_em && <div><dt>Fechamento</dt><dd>{dataHora(chamado.fechado_em)}</dd></div>}
              {processoMob && (
                <div>
                  <dt>Mobilização</dt>
                  <dd>
                    <Link to={`/mobilizacao/processo/${processoMob.id}`}>Processo #{processoMob.numero}</Link>
                    {' '}· {processoMob.etapas_concluidas} de {processoMob.etapas_total} passos
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <FluxoAprovacao
            etapas={etapas}
            nomes={nomesEtapas}
            atendenteNome={chamado.atendenteNome}
            status={chamado.status}
            fechadoEm={chamado.fechado_em}
          />
        </aside>
      </div>
    </div>
  );
}
