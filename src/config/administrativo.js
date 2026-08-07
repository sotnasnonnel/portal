import {
  Users, ShoppingCart, Car, Navigation, Mail, Building2, Monitor, Plane, HardHat, MoreHorizontal,
} from 'lucide-react';

/**
 * Catálogo do módulo Administrativo — espelha o Milldesk que a empresa usa hoje
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
 * empresa: some do AppSwitcher e a rota /administrativo devolve para a Home.
 *
 * A exceção é a lista abaixo, que continua navegando normalmente para testar
 * com o módulo ainda fechado. É por e-mail, e não por papel, de propósito: o
 * papel de admin do Adm será dado a mais gente antes do lançamento, e isso não
 * pode destravar o módulo sem querer.
 *
 * Home, AppSwitcher e AppRoutes leem daqui; para abrir a todos, ADM_EM_BREVE = false.
 */
export const ADM_EM_BREVE = true;

export const ADM_LIBERADOS = [
  'marcus.guimaraes@phdengenharia.eng.br',
  'andre.guimaraes@phdengenharia.eng.br',
];

export const podeAcessarAdm = (user) => !ADM_EM_BREVE
  || ADM_LIBERADOS.includes((user?.email || '').trim().toLowerCase());

/**
 * Cadastro de campos extras escondido enquanto a tela não é validada. O motor
 * continua de pé: serviço que já tenha campos gravados segue mostrando os
 * campos no formulário — o que some é a edição.
 */
export const CAMPOS_EXTRAS_VISIVEIS = false;

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
