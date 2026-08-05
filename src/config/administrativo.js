import {
  Users, ShoppingCart, Car, Navigation, Building2, Wrench, Plane, HardHat, Laptop, MoreHorizontal,
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
 * Trava de lançamento. Enquanto `true`, o módulo aparece como "Em breve" e
 * ninguém entra: some do AppSwitcher e a rota /administrativo devolve para a
 * Home. É o único ponto a mexer para liberar o módulo — Home, AppSwitcher e
 * AppRoutes leem daqui.
 */
export const ADM_EM_BREVE = true;

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
      { slug: 'nova-mobilizacao', label: 'Nova mobilização' },
      { slug: 'desmobilizacao', label: 'Desmobilização' },
      { slug: 'movimentacao-profissional', label: 'Movimentação de profissional' },
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
  {
    slug: 'uber',
    label: 'Solicitação de Uber',
    icon: Navigation,
    servicos: [
      { slug: 'viagem-uber', label: 'Solicitação de viagem Uber' },
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
    slug: 'manutencao-equipamentos',
    label: 'Manutenção de equipamentos',
    icon: Wrench,
    servicos: [
      { slug: 'manutencao-equipamento', label: 'Manutenção em Equipamento' },
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
      { slug: 'novo-alojamento-phd', label: 'Montagem de novo alojamento PHD' },
    ],
  },
  {
    slug: 'saude-seguranca',
    label: 'Saúde e segurança',
    icon: HardHat,
    servicos: [
      { slug: 'epi', label: 'Solicitação de EPI' },
      { slug: 'uniforme', label: 'Solicitação de uniforme' },
      { slug: 'locacao-equipamento', label: 'Locação de equipamento' },
      { slug: 'outras-demandas', label: 'Outras demandas' },
    ],
  },
  {
    slug: 'equipamentos',
    label: 'Solicitação de Equipamento',
    icon: Laptop,
    servicos: [
      { slug: 'equipamentos-adicionais', label: 'Equipamentos adicionais' },
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

/** Assunto do chamado = título do serviço (campo não digitado pelo solicitante). */
export const assuntoDoServico = (classeSlug, servicoSlug) =>
  getServico(classeSlug, servicoSlug)?.label || '';

/** Lista achatada (classe + serviço) para buscas e telas de listagem. */
export const TODOS_SERVICOS = CLASSES_ADM.flatMap((c) =>
  c.servicos.map((s) => ({ ...s, classeSlug: c.slug, classeLabel: c.label, icon: c.icon }))
);
