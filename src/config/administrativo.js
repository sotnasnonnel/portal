import {
  Users, ShoppingCart, Car, Navigation, Mail, Building2, Monitor, Plane, HardHat, MoreHorizontal,
  Headset, Boxes, Route,
} from 'lucide-react';
// Os gates de Estoque e Mobilização entram aqui porque o card da Home reúne os
// três módulos (ver AREAS_ADMINISTRATIVO no fim do arquivo). A dependência é de
// mão única: nenhum dos dois importa este arquivo de volta.
import { podeAcessarEstoque } from './estoque.js';
import { podeAcessarMobilizacao } from './mobilizacao.js';

/**
 * Catálogo do módulo Atendimento — espelha o Milldesk que a empresa usa hoje
 * (tela de referência: referencia/exemplo_mildesk.png).
 *
 * VOCABULÁRIO (o Milldesk usa "tipo" para duas coisas diferentes; aqui elas têm
 * nomes distintos para o código não confundir):
 * - NATUREZA → o dropdown "Tipo (*)" da tela. É a MESMA lista para todas as
 *   classes (incidente, materiais, solicitação de informação, solicitação de
 *   serviço). Quais naturezas cada serviço aceita ainda será definido.
 * - CLASSE   → o agrupador (Mobilização, Gestão de frota, ...).
 * - SERVIÇO  → o "tipo de serviço" dentro da classe (Nova mobilização, ...).
 *
 * O campo "Assunto" do chamado NÃO é digitado: é sempre o `label` do serviço
 * escolhido. Os "Campos extras" (a 2ª aba da tela do Milldesk) variam por
 * serviço e ainda não foram levantados — entram aqui como `campos: [...]`.
 *
 * Slug de serviço é único DENTRO da classe, não globalmente ("outras-demandas"
 * existe em frota, em saúde e segurança e como classe própria). A chave real de
 * um serviço é o par (classe, serviço) — é assim que a URL o identifica:
 * /administrativo/novo/:classe/:servico
 */

/**
 * Trava de lançamento. Enquanto `true`, o módulo aparece como "Em breve" para a
 * empresa: o card da Home fica travado e a rota /administrativo devolve para lá.
 *
 * ABERTO em 21/08/2026 — o módulo está liberado para toda a empresa. A lista
 * abaixo fica só como registro de quem testou antes; ela não tem efeito
 * enquanto ADM_EM_BREVE for false.
 *
 * Home e AppRoutes leem daqui; para fechar de novo, volte a true.
 */
export const ADM_EM_BREVE = false;

export const ADM_LIBERADOS = [
  'marcus.guimaraes@phdengenharia.eng.br',
  'andre.guimaraes@phdengenharia.eng.br',
  'jarbas.junior@phdengenharia.eng.br',
  'lennon.santos@phdengenharia.eng.br',
];

/**
 * Quem pode trocar o responsável de um chamado.
 *
 * Mais restrito que "time do Adm": assumir é pegar para si, e qualquer
 * atendente pode; trocar o responsável é mexer na fila alheia, e é decisão de
 * coordenação. Nenhum papel separa esse grupo — Jarbas é admin e Daniela é
 * atendente —, então é capacidade própria: colaboradores.administrativo_reatribui.
 *
 * O banco é quem manda: um gatilho em chamados_adm barra a troca de
 * atendente_id para quem não tem a capacidade. Isto aqui só decide se o botão
 * aparece, e lê o MESMO campo, para não haver duas listas divergindo.
 */
export const podeReatribuirAdm = (user) => user?.admReatribui === true;

export const podeAcessarAdm = (user) => !ADM_EM_BREVE
  || ADM_LIBERADOS.includes((user?.email || '').trim().toLowerCase());

/**
 * Cadastro de campos extras. Ficou escondido enquanto o caminho não fechava:
 * os campos eram gravados mas só apareciam nos dois serviços sem formulário
 * próprio, falhando calado nos outros 24. Corrigido e reaberto.
 */
export const CAMPOS_EXTRAS_VISIVEIS = true;

export const NATUREZAS = [
  { valor: 'incidente', label: 'Incidente' },
  { valor: 'materiais', label: 'Materiais' },
  { valor: 'solicitacao_informacao', label: 'Solicitação de informação' },
  { valor: 'solicitacao_servico', label: 'Solicitação de serviço' },
];

export const CLASSES_ADM = [
  {
    slug: 'mobilizacao',
    label: 'Mobilização',
    icon: Users,
    servicos: [
      // As três situações (nova, movimentação e desmobilização) viraram UM
      // serviço: mudam poucos campos entre elas e todas falam da mesma coisa,
      // uma pessoa. Um seletor dentro do formulário diz qual é, e o assunto do
      // chamado passa a ser a opção escolhida — assim a fila do Adm continua
      // distinguindo as três.
      { slug: 'mobilizacao', label: 'Mobilização de profissional', assuntoPorCampo: 'movimento' },
    ],
  },
  {
    slug: 'compra',
    label: 'Solicitação de compra',
    icon: ShoppingCart,
    servicos: [
      { slug: 'solicitacao-compra', label: 'Solicitação de compra' },
    ],
  },
  {
    slug: 'frota',
    label: 'Gestão de frota',
    icon: Car,
    servicos: [
      { slug: 'manutencao-veiculo-programada', label: 'Manutenção de veículo (programada)' },
      { slug: 'manutencao-veiculo-corretiva', label: 'Manutenção de veículo (corretiva)' },
      { slug: 'recarga-ticket-log', label: 'Recarga adicional Ticket Log' },
      { slug: 'reserva-veiculos', label: 'Reserva de veículos' },
      { slug: 'outras-demandas', label: 'Outras demandas' },
    ],
  },
  // Uber e Correio aparecem na aba de Frota da planilha, mas são cards
  // próprios no catálogo: quem precisa de uma corrida não procura em
  // "Gestão de frota". Os campos dos dois são os mesmos (CC, origem,
  // destino, data, horário, justificativa).
  {
    slug: 'uber',
    label: 'Solicitação de Uber',
    icon: Navigation,
    servicos: [
      { slug: 'viagem-uber', label: 'Solicitação de viagem Uber' },
    ],
  },
  {
    slug: 'correio',
    label: 'Correio',
    icon: Mail,
    servicos: [
      { slug: 'correio', label: 'Solicitação de correio' },
    ],
  },
  {
    slug: 'manutencao-predial',
    label: 'Manutenção predial',
    icon: Building2,
    servicos: [
      { slug: 'manutencao-alojamento', label: 'Manutenção Alojamento' },
      { slug: 'manutencao-sede', label: 'Manutenção Sede' },
    ],
  },
  {
    // Substitui a antiga "Manutenção de equipamentos", que tinha um serviço só:
    // a planilha detalha seis frentes de TI.
    slug: 'ti',
    label: 'Manutenção & Instalação TI',
    icon: Monitor,
    servicos: [
      { slug: 'instalacao-software', label: 'Instalação de software' },
      // Novo na revisão: antes só existia a troca. Pedir um equipamento novo e
      // trocar um que quebrou são pedidos diferentes.
      { slug: 'solicitacao-equipamentos', label: 'Solicitação de equipamentos e acessórios' },
      { slug: 'troca-equipamentos', label: 'Troca de equipamentos e acessórios' },
      { slug: 'liberacao-acessos', label: 'Liberação de acessos' },
      { slug: 'impressoras', label: 'Instalação e configuração de impressoras' },
      { slug: 'manutencao-infraestrutura', label: 'Manutenção de infraestrutura' },
      { slug: 'verificacoes', label: 'Verificações' },
    ],
  },
  {
    slug: 'viagem-hospedagem',
    label: 'Viagem e hospedagem',
    icon: Plane,
    servicos: [
      { slug: 'passagem', label: 'Solicitação de passagem' },
      { slug: 'hospedagem', label: 'Solicitação de hospedagem' },
      { slug: 'vagas-alojamento-phd', label: 'Solicitação de vagas em alojamento PHD' },
      // Era "Montagem de novo alojamento PHD"; a planilha trata como locação.
      { slug: 'locacao-imovel', label: 'Locação de imóvel' },
    ],
  },
  {
    slug: 'saude-seguranca',
    label: 'Saúde e segurança',
    icon: HardHat,
    // EPI e uniforme também podem ser pedidos dentro da Mobilização (marcadores).
    // Aqui é o pedido avulso, para quem já está mobilizado e precisa de item
    // novo ou de substituição — daí o campo "motivo" na planilha.
    servicos: [
      { slug: 'epi', label: 'Solicitação de EPI' },
      { slug: 'uniforme', label: 'Solicitação de uniforme' },
      { slug: 'outras-demandas', label: 'Outras demandas' },
    ],
  },
  {
    slug: 'outras-demandas',
    label: 'Outras demandas',
    icon: MoreHorizontal,
    servicos: [
      { slug: 'outras-demandas', label: 'Outras demandas' },
    ],
  },
];

export const getClasse = (classeSlug) => CLASSES_ADM.find((c) => c.slug === classeSlug);

export const getServico = (classeSlug, servicoSlug) =>
  getClasse(classeSlug)?.servicos.find((s) => s.slug === servicoSlug);

/**
 * Assunto do chamado. Em regra é o título do serviço (nunca digitado). Serviço
 * que juntou dois pedidos num formulário só — Mobilização — declara
 * `assuntoPorCampo`, e aí o assunto vem da opção escolhida no seletor, para a
 * fila continuar distinguindo "Nova mobilização" de "Movimentação".
 */
export const assuntoDoServico = (classeSlug, servicoSlug, valores = {}) => {
  const srv = getServico(classeSlug, servicoSlug);
  if (!srv) return '';
  const doCampo = srv.assuntoPorCampo ? valores[srv.assuntoPorCampo] : '';
  return doCampo || srv.label;
};

/** Lista achatada (classe + serviço) para buscas e telas de listagem. */
export const TODOS_SERVICOS = CLASSES_ADM.flatMap((c) =>
  c.servicos.map((s) => ({ ...s, classeSlug: c.slug, classeLabel: c.label, icon: c.icon }))
);

/**
 * As três áreas do card "Atendimento" da Home.
 *
 * Chamados, Estoque e Mobilização eram três cards soltos, lado a lado, como se
 * fossem três assuntos diferentes — e são o mesmo: o time do Adm. Quem atende o
 * chamado de EPI é quem dá baixa no estoque, e quem toca a mobilização é o
 * mesmo pessoal. Reunidos num card só, a Home para de pedir que a pessoa saiba
 * de antemão em qual dos três o que ela precisa mora.
 *
 * O gate continua sendo de CADA módulo, não deste agrupamento: Estoque e
 * Mobilização ainda estão em lançamento restrito, e só aparecem para quem já
 * entrava neles. Por isso a lista é filtrada por `areasAdministrativoDe` em vez
 * de ser fixa.
 *
 * Mesmo desenho de AREAS_FINANCEIRO e AREAS_HORAS — a Home já faz essa mesma
 * pergunta ("por onde começar?") em três cards, e um quarto jeito de perguntar
 * seria uma Home diferente dentro da mesma Home.
 */
export const AREAS_ADMINISTRATIVO = [
  {
    slug: 'chamados',
    label: 'Chamados',
    icon: Headset,
    desc: 'Abra e acompanhe chamados de frota, viagem, compras e manutenção.',
    href: '/administrativo/novo',
    cta: 'Abrir chamados',
    pode: podeAcessarAdm,
  },
  {
    slug: 'estoque',
    label: 'Estoque',
    icon: Boxes,
    desc: 'Almoxarifado de EPIs e uniformes: saldo, entradas e saídas.',
    href: '/estoque/posicao',
    cta: 'Abrir estoque',
    pode: podeAcessarEstoque,
  },
  {
    slug: 'mobilizacao',
    label: 'Mobilização',
    icon: Route,
    desc: 'O passo a passo da mobilização e da desmobilização de pessoas.',
    href: '/mobilizacao/kanban',
    cta: 'Abrir mobilização',
    pode: podeAcessarMobilizacao,
  },
];

/** Só as áreas que a pessoa pode abrir. Vazio = card travado na Home. */
export const areasAdministrativoDe = (user) => AREAS_ADMINISTRATIVO.filter((a) => a.pode(user));
