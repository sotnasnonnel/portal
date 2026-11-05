import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Navigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Paperclip, X, Send, AlertCircle, FileText, CheckCircle2, Loader2, Star,
  Layers, Clock,
} from 'lucide-react';
import { getClasse, getServico, assuntoDoServico } from '../../../../config/administrativo';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  criarChamado, criarMobilizacaoComAdicionais, buscarConfigServico, listarPessoas,
  listarProjetos, buscarAvaliacaoPendente, buscarCentroDeCusto, listarCentrosDeCusto,
} from '../../lib/chamados';
import { desdobrarMobilizacao } from '../../lib/desdobramento';
import { validarCamposExtras, limparValores, mesclarComExtras } from '../../lib/camposExtras';
import { errosDoEsquema, errosDoServico, ariaDoErro } from '../../lib/errosDeCampo';
import CampoExtra from './CampoExtra';
import ErroCampo from './ErroCampo';
import { formDoServico } from './formularios';
import { usaDescricao, usaAnexo } from './formularios/schemas';
import { formatarTamanho } from '../../lib/arquivo';
import {
  PARA_MIM, PARA_OUTRA, perguntaParaQuem, colaboradorDoChamado, validarParaQuem,
} from '../../lib/paraQuem';
import SearchSelect from '../../../../components/UI/SearchSelect';

// O seletor "Tipo" do Milldesk (incidente/materiais/informação/serviço) saiu da
// tela: ninguém escolhia outra coisa, já que todo item do catálogo é serviço.
// A coluna continua no banco, preenchida com este valor.
const NATUREZA_PADRAO = 'solicitacao_servico';

/**
 * "Fulano", "Fulano e Beltrano", "Fulano, Beltrano e Sicrano" — na ordem em que
 * vão decidir. Nomear quem aprova evita a leitura de que dois pedidos parecidos
 * foram para pessoas diferentes por defeito: o que muda o aprovador é o valor.
 */
const listarNomes = (nomes = []) => (nomes.length <= 1
  ? (nomes[0] || '')
  : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`);

const vazioNoForm = (v) => v === undefined || v === null || v === '' || v === false
  || (Array.isArray(v) && v.length === 0);

/**
 * A pessoa já escreveu alguma coisa? O CC fica de fora: vem preenchido sozinho
 * pelo organograma, e sair sem ter tocado em nada não deve pedir confirmação.
 */
const preencheuAlgo = (valores, inicial) => Object.entries(valores).some(([k, v]) => (
  k !== 'cc' && !vazioNoForm(v) && JSON.stringify(v) !== JSON.stringify(inicial[k])
));

export default function NovoChamadoAdm() {
  const { classe, servico } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const inputArquivo = useRef(null);

  const [descricao, setDescricao] = useState('');
  const [anexos, setAnexos] = useState([]);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(null);   // { numero, atendenteNome, aguardandoAprovacao }
  const [config, setConfig] = useState(null);     // null = ainda carregando
  const [pessoas, setPessoas] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [pendente, setPendente] = useState(null); // avaliação que trava a abertura
  // Centro de custo do aprovador. '' = ninguém acima com gerência; null = carregando.
  const [centroCusto, setCentroCusto] = useState(null);
  // Centros de custo para trocar o do organograma. Vazia (consulta falhou), o
  // campo cai no comportamento antigo: travado no valor que veio.
  const [opcoesCc, setOpcoesCc] = useState([]);
  const avisoErro = useRef(null);
  const avisoPendente = useRef(null);
  // Contador de tentativas, não o texto do erro: errar DUAS vezes no mesmo campo
  // repete a mesma mensagem, e um efeito preso ao texto não dispararia de novo.
  const [tentativa, setTentativa] = useState(0);
  // Depois da primeira recusa os erros são recalculados a cada tecla: somem
  // sozinhos conforme a pessoa corrige, sem precisar clicar em enviar de novo
  // para descobrir se resolveu.
  const [validarAoVivo, setValidarAoVivo] = useState(false);
  const refForm = useRef(null);
  const tituloSucesso = useRef(null);

  // Serviço com formulário próprio (mobilização) traz o estado inicial dele;
  // os demais começam com os campos extras cadastrados, que são chave/valor.
  const form = formDoServico(classe, servico);
  const [extras, setExtras] = useState(() => (form ? form.estadoInicial() : {}));
  // Para quem é o chamado. A pessoa é confrontada com a Folga de Campo e a
  // Ausência Programada: se estiver fora, o SLA só começa na volta dela.
  const [paraQuem, setParaQuem] = useState(PARA_MIM);
  const [outraPessoaId, setOutraPessoaId] = useState('');
  const temParaQuem = perguntaParaQuem(classe, servico);

  // Trocar de serviço limpa o formulário (reset durante o render, padrão
  // recomendado pelo React em vez de setState dentro de useEffect).
  const chaveAtual = `${classe}/${servico}`;
  const [chaveAnterior, setChaveAnterior] = useState(chaveAtual);
  if (chaveAtual !== chaveAnterior) {
    setChaveAnterior(chaveAtual);
    setDescricao('');
    setAnexos([]);
    setErro('');
    setSucesso(null);
    setExtras(form ? form.estadoInicial() : {});
    setConfig(null);
    setParaQuem(PARA_MIM);
    setOutraPessoaId('');
    setValidarAoVivo(false);
  }

  // Lista de pessoas para os seletores com busca. Só paga essa consulta o
  // formulário que pede pessoa, ou quem marcou que o chamado é para outra.
  const precisaPessoas = !!form?.precisaPessoas || (temParaQuem && paraQuem === PARA_OUTRA);
  useEffect(() => {
    if (!precisaPessoas) return undefined;
    let cancelado = false;
    // Com candidatos: quem ainda está em contratação também viaja, é mobilizado
    // e recebe EPI — e antes o pedido saía no nome de outra pessoa.
    listarPessoas({ comCandidatos: true })
      .then((lista) => { if (!cancelado) setPessoas(lista); })
      .catch((e) => { if (!cancelado) setErro(e.message); });
    return () => { cancelado = true; };
  }, [precisaPessoas]);

  // Projetos do portal (os mesmos do módulo Horas) para o formulário que
  // precisa dizer ONDE a pessoa vai trabalhar. Leitura livre, mas só o
  // formulário que pede paga a consulta.
  useEffect(() => {
    if (!form?.precisaProjetos) return undefined;
    let cancelado = false;
    listarProjetos()
      .then((lista) => { if (!cancelado) setProjetos(lista); })
      // Silencioso: sem a lista o campo continua aceitando o nome digitado,
      // que é melhor do que travar a abertura do chamado por causa dela.
      .catch(() => {});
    return () => { cancelado = true; };
  }, [form?.precisaProjetos]);

  // A trava do POP 9.1 é da RLS, mas descobri-la só no envio faz a pessoa
  // preencher o formulário inteiro para levar um "não" — e sem saber qual
  // chamado avaliar. Consultada na abertura, ela vira um aviso com link.
  const verificarPendencia = useCallback(async () => {
    if (!user?.id) return;
    try {
      const p = await buscarAvaliacaoPendente(user.id);
      setPendente(p);
      // Quem avalia numa aba e volta para esta encontrava o aviso do envio
      // anterior ainda na tela: `erro` só é reescrito no envio seguinte, então
      // a mensagem sobrevivia ao próprio motivo dela.
      if (!p) setErro((atual) => (/avalia/i.test(atual) ? '' : atual));
    } catch {
      // Silencioso: a RLS barra de todo jeito no envio.
    }
  }, [user?.id]);

  // Revalidado ao voltar para a aba, e não só na montagem: avaliar acontece em
  // outra tela, e às vezes em outra janela.
  useEffect(() => {
    verificarPendencia();
    window.addEventListener('focus', verificarPendencia);
    return () => window.removeEventListener('focus', verificarPendencia);
  }, [verificarPendencia]);

  // Envio recusado: rola até o aviso e o foca. Sem isso, em serviço com muitos
  // campos o erro aparece fora da tela e o clique parece não ter funcionado.
  // Focar (e não só rolar) leva junto quem navega por teclado e faz o leitor de
  // tela anunciar o motivo.
  // Erro de campo vai para o PRIMEIRO campo errado na ordem da tela, já com o
  // cursor nele; o aviso do topo fica para o que não é de campo nenhum (avaliação
  // pendente, recusa do servidor).
  useEffect(() => {
    if (!tentativa) return;
    const campo = refForm.current?.querySelector('.adm-campo-erro')?.closest('.adm-campo');
    const aviso = avisoErro.current || avisoPendente.current;
    const alvoDeRolagem = aviso || campo;
    if (!alvoDeRolagem) return;
    const semAnimacao = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    alvoDeRolagem.scrollIntoView({
      behavior: semAnimacao ? 'auto' : 'smooth', block: 'center',
    });
    const alvoDeFoco = aviso || (campo.matches('[data-foco-no-campo]')
      ? campo
      // O seletor de pessoa antes de tudo: em "Para quem" o erro é não ter escolhido
      // a pessoa, e o primeiro botão do campo é o chip que já está certo.
      : campo.querySelector('.ss2-btn')
        || campo.querySelector('input:not([readonly]), select, textarea, button'));
    alvoDeFoco?.focus({ preventScroll: true });
  }, [tentativa]);

  // A confirmação troca a tela inteira: o botão que tinha o foco deixou de
  // existir, e quem estava no fim de um formulário longo não veria o resultado.
  const abriuChamado = !!sucesso;
  useEffect(() => {
    if (!abriuChamado) return;
    window.scrollTo({ top: 0 });
    tituloSucesso.current?.focus({ preventScroll: true });
  }, [abriuChamado]);

  // Centro de custo vem do organograma, não do teclado: digitado à mão, cada
  // pessoa escrevia de um jeito e nenhum relatório por CC fechava depois. E é o
  // do APROVADOR — o gasto corre por conta de quem avaliza, não de quem pede.
  // Depende da classe porque a cadeia cadastrada pode mudar por classe.
  useEffect(() => {
    let cancelado = false;
    // Volta a "carregando" antes de buscar: sem isso, trocar de serviço deixaria
    // o CC anterior preenchido caso o novo venha vazio.
    setCentroCusto(null);
    buscarCentroDeCusto({
      solicitanteId: user?.id, classe, gerenciaPropriaId: user?.horasGerenciaId,
    })
      .then((n) => { if (!cancelado) setCentroCusto(n); })
      .catch(() => { if (!cancelado) setCentroCusto(''); });
    return () => { cancelado = true; };
  }, [user?.id, user?.horasGerenciaId, classe]);

  // Lista de centros de custo, para qualquer pessoa que abra chamado. Era
  // restrita a quem tinha a permissão avulsa, e o resultado é que todo pedido
  // de uma área para outra virava chamado aberto no CC errado, corrigido depois
  // pelo Adm. O padrão continua sendo o do organograma — muda só o poder de
  // trocar.
  useEffect(() => {
    let cancelado = false;
    listarCentrosDeCusto()
      .then((l) => { if (!cancelado) setOpcoesCc(l); })
      .catch(() => { if (!cancelado) setOpcoesCc([]); });
    return () => { cancelado = true; };
  }, []);

  // Preenche o campo assim que o nome chega, sem pisar no que a pessoa digitou
  // (nos casos em que ela pôde digitar, por não ter gerência).
  useEffect(() => {
    if (!centroCusto) return;
    setExtras((a) => (a.cc === centroCusto ? a : { ...a, cc: centroCusto }));
  }, [centroCusto, chaveAtual]);

  // Definição dos campos extras: vem do cadastro, por serviço.
  useEffect(() => {
    let cancelado = false;
    buscarConfigServico(classe, servico)
      .then((cfg) => { if (!cancelado) setConfig(cfg); })
      .catch((e) => { if (!cancelado) { setConfig({ campos_extras: [] }); setErro(e.message); } });
    return () => { cancelado = true; };
  }, [classe, servico]);

  const cls = getClasse(classe);
  const srv = getServico(classe, servico);
  // Descrição e anexo só onde a planilha pede.
  const temDescricao = usaDescricao(classe, servico);
  const temAnexo = usaAnexo(classe, servico);

  // Mobilização desdobra os adicionais em chamados próprios. Calculado durante
  // o preenchimento para a pessoa ver o que vai acontecer antes de enviar —
  // descobrir depois que "abriu 4 chamados" pareceria erro do sistema.
  const ehMobilizacao = classe === 'mobilizacao' && servico === 'mobilizacao';
  const desdobramentos = ehMobilizacao ? desdobrarMobilizacao(extras) : [];

  // Par (classe, serviço) inexistente: volta ao catálogo.
  if (!srv) return <Navigate to="/administrativo/novo" replace />;

  const Icon = cls.icon;

  // Tudo que os validadores têm a dizer, ligado aos campos. A decisão de barrar
  // o envio continua nas mesmas validações de `enviar`; daqui sai só o desenho.
  const calcularErros = () => {
    const doForm = form
      ? errosDoServico({ classe, servico, validar: form.validar, valores: extras })
      : { erros: {}, semCampo: '' };
    const paraQuemErro = validarParaQuem({ classe, servico, paraQuem, outraPessoaId });
    return {
      erros: {
        ...(temDescricao && !descricao.trim() ? { descricao: 'A descrição é obrigatória.' } : {}),
        ...(paraQuemErro ? { para_quem: paraQuemErro } : {}),
        ...doForm.erros,
        ...errosDoEsquema(config?.campos_extras || [], extras),
      },
      semCampo: doForm.semCampo,
    };
  };
  const errosCampo = validarAoVivo ? calcularErros().erros : {};
  const temErroCampo = Object.keys(errosCampo).length > 0;

  // Só pergunta quando há o que perder: mobilização é uma tela e meia de campos,
  // e o "Voltar" fica a um dedo do título no celular.
  const sair = () => {
    const alterado = !!descricao.trim() || anexos.length > 0
      || preencheuAlgo(extras, form ? form.estadoInicial() : {});
    if (alterado && !window.confirm('Sair e descartar o que você preencheu?')) return;
    navigate('/administrativo/novo');
  };

  const adicionarAnexos = (e) => {
    const novos = Array.from(e.target.files || []);
    if (novos.length) setAnexos((atual) => [...atual, ...novos]);
    e.target.value = ''; // permite reescolher o mesmo arquivo depois de remover
  };

  const removerAnexo = (idx) => setAnexos((atual) => atual.filter((_, i) => i !== idx));

  // O botão fica no fim do formulário e o aviso no topo: em serviço com muitos
  // campos, o erro nasce fora da tela e a pessoa acha que o clique não pegou.
  const falhar = (msg) => {
    setErro(msg);
    setTentativa((n) => n + 1);
  };

  // Recusa de validação: os erros aparecem nos campos. Só o que não tem campo
  // onde ficar continua no aviso, para nenhuma recusa acontecer em silêncio.
  const falharValidacao = (msg) => {
    const { erros, semCampo } = calcularErros();
    setValidarAoVivo(true);
    falhar(semCampo || (Object.keys(erros).length ? '' : msg));
  };

  const enviar = async (e) => {
    e.preventDefault();
    // A avaliação pendente é o PRIMEIRO motivo de recusa, e precisa ser dito
    // no clique. Enquanto ela só desabilitava o botão, quem preenchia o
    // formulário inteiro (mobilização tem uma tela e meia de campos) clicava
    // em "Abrir chamado" e não acontecia absolutamente nada: botão
    // desabilitado não dispara evento, e o aviso ficava lá em cima, fora da
    // tela. Agora o clique passa, é recusado com o motivo e a tela sobe até
    // ele — o mesmo caminho de qualquer outro campo faltando.
    // Sobe até o próprio aviso da avaliação, que já tem o motivo e o botão: um
    // segundo aviso vermelho com o mesmo texto só disputaria atenção com ele.
    if (pendente) {
      setTentativa((n) => n + 1);
      return undefined;
    }
    if (temDescricao && !descricao.trim()) return falharValidacao('A descrição é obrigatória.');
    const definicao = config?.campos_extras || [];
    // As duas validações: a do formulário do serviço e a dos campos cadastrados.
    // Antes só uma delas rodava, então campo extra obrigatório num serviço com
    // formulário próprio passava batido.
    const erroExtra = validarParaQuem({ classe, servico, paraQuem, outraPessoaId })
      || (form ? form.validar(extras) : '')
      || validarCamposExtras(definicao, extras);
    if (erroExtra) return falharValidacao(erroExtra);
    setErro('');
    setEnviando(true);
    const colaboradorId = colaboradorDoChamado({
      classe, servico, campos: extras, paraQuem, outraPessoaId, solicitanteId: user.id,
    });
    try {
      // Mobilização tem caminho próprio: além do pedido dela, abre um chamado
      // para cada adicional escolhido, no serviço que já cuida daquilo.
      if (ehMobilizacao) {
        const r = await criarMobilizacaoComAdicionais({
          assunto: assuntoDoServico(classe, servico, extras),
          natureza: NATUREZA_PADRAO,
          descricao,
          campos: extras,
          solicitanteId: user.id,
          config,
          colaboradorId,
        });
        setSucesso({
          id: r.chamado.id,
          numero: r.chamado.numero,
          atendenteNome: r.atendenteNome,
          aprovadores: r.aprovadoresNomes,
          aguardandoAprovacao: r.chamado.status === 'aguardando_aprovacao',
          filhos: r.filhos,
        });
        return;
      }

      const { chamado, atendenteNome, aprovadoresNomes } = await criarChamado({
        classe,
        servico,
        // Mobilização define o assunto pelo seletor (nova x movimentação);
        // nos demais o assunto é o próprio rótulo do serviço.
        assunto: assuntoDoServico(classe, servico, extras),
        natureza: NATUREZA_PADRAO,
        descricao,
        // Campos do serviço + campos extras cadastrados, no mesmo objeto.
        campos: form ? mesclarComExtras(extras, definicao) : limparValores(definicao, extras),
        arquivos: temAnexo ? anexos : [],
        solicitanteId: user.id,
        config,
        colaboradorId,
      });
      setSucesso({
        id: chamado.id,
        numero: chamado.numero,
        atendenteNome,
        aprovadores: aprovadoresNomes,
        aguardandoAprovacao: chamado.status === 'aguardando_aprovacao',
      });
    } catch (err) {
      // Também aqui: a recusa do servidor (alçada sem aprovador, RLS) chega
      // depois do upload, quando a pessoa já rolou a tela para baixo.
      falhar(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="adm-page">
      {!sucesso && (
        <button type="button" className="adm-back adm-back-toque" onClick={sair}>
          <ArrowLeft size={16} aria-hidden="true" /> Voltar ao catálogo
        </button>
      )}

      <div className="adm-form-cab">
        <span className="adm-cat-ico"><Icon size={24} aria-hidden="true" /></span>
        <div>
          <h1>{srv.label}</h1>
          {/* Em várias classes de um serviço só, os dois nomes são iguais. */}
          {cls.label !== srv.label && <small>{cls.label}</small>}
          {/* "Quanto tempo demora?" é a dúvida de quem está pedindo, e até aqui
              a resposta só existia no relógio da barra. Vem da configuração do
              serviço, nunca de texto fixo. */}
          {!sucesso && config?.sla_dias_uteis > 0 && (
            <small className="adm-form-prazo">
              <Clock size={13} aria-hidden="true" />
              Prazo de atendimento: {config.sla_dias_uteis} {config.sla_dias_uteis === 1 ? 'dia útil' : 'dias úteis'}, contados depois da aprovação
            </small>
          )}
        </div>
      </div>

      {/* Passo 5 do POP: ao salvar, o solicitante precisa saber o número e com
          quem o chamado ficou. Aqui isso é a tela toda, não um alert. */}
      {sucesso ? (
        <div className="adm-card adm-sucesso">
          <CheckCircle2 size={40} aria-hidden="true" />
          <h2 ref={tituloSucesso} tabIndex={-1}>Chamado #{sucesso.numero} aberto</h2>
          {sucesso.aguardandoAprovacao ? (
            <p>
              Sua solicitação foi cadastrada e enviada para aprovação
              {sucesso.aprovadores?.length ? <> de <strong>{listarNomes(sucesso.aprovadores)}</strong></> : null}.
              {' '}O prazo de atendimento começa a contar assim que o gestor aprovar.
            </p>
          ) : (
            <p>
              {sucesso.atendenteNome
                ? <>Sua solicitação foi cadastrada e atribuída ao técnico <strong>{sucesso.atendenteNome}</strong>.</>
                : 'Sua solicitação foi cadastrada. O time do Atendimento vai definir o responsável.'}
            </p>
          )}
          {/* Os adicionais viraram pedidos próprios: dizer quais e com que
              número evita a impressão de que o portal abriu chamado demais. */}
          {sucesso.filhos?.length > 0 && (
            <div className="adm-sucesso-filhos">
              <strong>Também foram abertos, cada um com seu aprovador e prazo:</strong>
              <ul>
                {sucesso.filhos.map((f) => (
                  <li key={f.numero}>
                    #{f.numero} — {f.rotulo || getServico(f.classe, f.servico)?.label || f.servico}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="adm-acoes">
            {/* Direto ao chamado recém-aberto: procurá-lo na lista é um passo a
                mais para quem quer conferir o pedido ou mandar um anexo. */}
            <Link className="adm-btn adm-btn-primary" to={`/administrativo/chamado/${sucesso.id}`}>
              Acompanhar chamado
            </Link>
            <Link className="adm-btn adm-btn-ghost" to="/administrativo/meus">Meus chamados</Link>
            <Link className="adm-btn adm-btn-ghost" to="/administrativo/novo">Abrir outro</Link>
          </div>
        </div>
      ) : (
      <form onSubmit={enviar} noValidate ref={refForm}>
        {erro && (
          <div className="adm-aviso tom-erro" ref={avisoErro} tabIndex={-1} role="alert">
            <AlertCircle size={16} aria-hidden="true" /> {erro}
          </div>
        )}

        {/* Avisado aqui em cima, com o número e o link: a trava é da RLS e vale
            de qualquer jeito, mas descobri-la depois de preencher tudo — e sem
            saber qual chamado é — não ajuda ninguém. */}
        {pendente && (
          <div className="adm-aviso tom-erro adm-aviso-acao adm-aviso-pendente"
            ref={avisoPendente} tabIndex={-1} role="alert">
            <Star size={16} aria-hidden="true" />
            <span className="adm-aviso-acao-txt">
              O chamado <strong>#{pendente.numero} — {pendente.assunto}</strong> foi fechado e
              ainda espera sua avaliação. Avalie-o para poder abrir um novo.
            </span>
            <Link className="adm-btn adm-btn-primary" to={`/administrativo/chamado/${pendente.id}`}>
              Avaliar agora
            </Link>
          </div>
        )}

        {/* UM cartão só. Antes os campos do serviço vinham num segundo cartão e
            a tela parecia dois formulários empilhados. */}
        <div className="adm-card adm-form-grade">
          {/* Assunto não é digitado: é o título do serviço, e o título já está
              aí em cima. O campo travado que repetia o mesmo texto em todo
              formulário empurrava para baixo o primeiro campo que importa. */}
          <p className="adm-form-legenda">Os campos com <span className="req">*</span> são obrigatórios.</p>

          {/* Meia largura, ao lado do primeiro campo do serviço (quase sempre o CC):
              assim os pares naturais que vêm depois (origem e destino, retirada e
              devolução) caem na mesma linha, em vez de um deles sobrar para a próxima. */}
          {temParaQuem && (
            <div className="adm-campo adm-campo-meia" role="group" aria-labelledby="adm-para-quem-rot">
              <span className="adm-campo-rotulo" id="adm-para-quem-rot">
                Para quem é este chamado?<span className="req">*</span>
              </span>
              <div className="adm-radios">
                {[[PARA_MIM, 'Para mim'], [PARA_OUTRA, 'Para outra pessoa']].map(([v, rotulo]) => (
                  <button key={v} type="button"
                    className={`adm-chip ${paraQuem === v ? 'is-on' : ''}`}
                    onClick={() => setParaQuem(v)} aria-pressed={paraQuem === v}>
                    {rotulo}
                  </button>
                ))}
              </div>
              {paraQuem === PARA_OUTRA && (
                <SearchSelect
                  value={outraPessoaId}
                  onChange={setOutraPessoaId}
                  options={pessoas.map((p) => ({ value: p.id, label: p.rotulo || p.nome }))}
                  placeholder="Busque pelo nome…"
                  ariaLabel="Pessoa para quem é o chamado"
                />
              )}
              <ErroCampo chave="para_quem" msg={errosCampo.para_quem} />
              {/* Só quando há "essa pessoa" a quem se referir. */}
              {paraQuem === PARA_OUTRA && (
                <span className="adm-campo-dica">
                  Se essa pessoa estiver de Folga de Campo ou em Ausência Programada, o prazo
                  começa a contar na volta dela.
                </span>
              )}
            </div>
          )}

          {/* Campos do serviço: no mesmo cartão, na sequência natural. */}
          {form && (
            <form.Componente valores={extras} onChange={setExtras} pessoas={pessoas}
              projetos={projetos}
              classe={classe} servico={servico}
              opcoesCc={opcoesCc} erros={errosCampo} />
          )}

          {/* Depois dos campos do serviço, nunca no lugar deles: o que o time do
              Adm cadastra é um acréscimo àquele formulário, não um substituto. */}
          {(config?.campos_extras || []).map((campo) => (
            <CampoExtra
              key={campo.chave}
              campo={campo}
              valor={extras[campo.chave]}
              onChange={(chave, valor) => setExtras((a) => ({ ...a, [chave]: valor }))}
              erro={errosCampo[campo.chave]}
            />
          ))}

          {temDescricao && (
          <div className="adm-campo">
            <label htmlFor="adm-descricao">Descrição<span className="req">*</span></label>
            <textarea
              id="adm-descricao"
              className="adm-textarea"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva a solicitação com o máximo de detalhes."
              aria-required="true"
              {...ariaDoErro('descricao', errosCampo.descricao)}
            />
            <ErroCampo chave="descricao" msg={errosCampo.descricao} />
          </div>
          )}

          {temAnexo && (
          <div className="adm-campo">
            <span className="adm-campo-rotulo">Anexos</span>
            <input
              ref={inputArquivo}
              type="file"
              multiple
              onChange={adicionarAnexos}
              style={{ display: 'none' }}
              aria-hidden="true"
              tabIndex={-1}
            />
            <button type="button" className="adm-anexo-btn" onClick={() => inputArquivo.current?.click()}>
              <Paperclip size={16} aria-hidden="true" /> Anexar arquivos
            </button>
            {anexos.length > 0 && (
              <ul className="adm-anexo-lista">
                {anexos.map((a, i) => (
                  <li key={`${a.name}-${i}`} className="adm-anexo-item">
                    <FileText size={16} aria-hidden="true" />
                    <span className="adm-anexo-nome" title={a.name}>{a.name}</span>
                    <span className="adm-anexo-tam">{formatarTamanho(a.size)}</span>
                    <button type="button" className="adm-anexo-x" onClick={() => removerAnexo(i)}
                      title="Remover" aria-label={`Remover ${a.name}`}>
                      <X size={15} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          )}
        </div>

        {/* Antes do botão, não depois: ver "serão abertos 4 chamados" só na tela
            de sucesso pareceria erro do sistema. */}
        {desdobramentos.length > 0 && (
          <div className="adm-aviso tom-info">
            <Layers size={16} aria-hidden="true" />
            <span>
              Os adicionais escolhidos serão abertos como pedidos separados, cada um com
              seu aprovador e prazo — a mobilização segue inteira, como você preencheu.
              Serão {desdobramentos.length === 1 ? 'mais 1 chamado' : `mais ${desdobramentos.length} chamados`}:
              {' '}
              {desdobramentos
                .map((f) => getServico(f.classe, f.servico)?.label || f.servico)
                .join(', ')}.
            </span>
          </div>
        )}

        {/* Presa ao pé da tela: em reserva de veículo ou mobilização o botão só
            aparecia depois de rolar o formulário inteiro. */}
        <div className="adm-acoes adm-acoes-fixas">
          <button type="submit" className="adm-btn adm-btn-primary" disabled={enviando}>
            {enviando
              ? <><Loader2 size={16} className="adm-spin" aria-hidden="true" /> Enviando…</>
              : <><Send size={16} aria-hidden="true" /> Abrir chamado</>}
          </button>
          <button type="button" className="adm-btn adm-btn-ghost" disabled={enviando} onClick={sair}>
            Cancelar
          </button>
          {/* Repetido junto do botão de propósito: o aviso do topo some da tela
              em formulário longo, e era ali que a pessoa descobria o motivo. */}
          {pendente && (
            <span className="adm-acoes-erro">
              <Star size={14} aria-hidden="true" />
              <span>
                Avalie o chamado #{pendente.numero} para poder abrir este:
                {' '}
                <Link className="adm-link" to={`/administrativo/chamado/${pendente.id}`}>avaliar agora</Link>
              </span>
            </span>
          )}
          {!pendente && temErroCampo && (
            <span className="adm-acoes-erro" role="status">
              <AlertCircle size={14} aria-hidden="true" /> Corrija os campos destacados
            </span>
          )}
        </div>
      </form>
      )}
    </div>
  );
}
