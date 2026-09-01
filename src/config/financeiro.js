import { CreditCard, Receipt, TrendingUp } from 'lucide-react';

/**
 * Fonte única das solicitações do módulo Financeiro (espelha src/config/requisicoes.js).
 * - slug: usado na URL /financeiro/solicitacoes/nova/:slug
 * - label: título completo exibido na tela
 * - curto: rótulo curto para chips/sidebar
 * - status: 'pronto' (tem formulário) | 'em_breve' (abre placeholder "Em construção")
 * - tipoDb: valor da coluna `tipo` em solicitacoes_financeiro (definido na Parte 2)
 */
export const SOLICITACOES_FIN = [
  { slug: 'cartao-virtual', label: 'Solicitação de Criação de Cartão', curto: 'Solicitação', icon: CreditCard, status: 'pronto', tipoDb: 'cartao_virtual' },
  { slug: 'aumento-limite', label: 'Solicitação de Aumento de Limite', curto: 'Aumento de Limite', icon: TrendingUp, status: 'pronto', tipoDb: 'aumento_limite' },
];

/**
 * Modalidades do cartão. O tipo da solicitação continua sendo 'cartao_virtual'
 * (fluxos, alçadas e aumento de limite não mudam) — o que muda é a modalidade:
 * o FÍSICO exige endereço de entrega e leva a estimativa de prazo abaixo.
 */
export const MODALIDADES_CARTAO = [
  { value: 'virtual', label: 'Cartão virtual', hint: 'Emitido no sistema, sem entrega física.' },
  { value: 'fisico', label: 'Cartão físico', hint: 'Enviado para o endereço informado.' },
];

export const modalidadeCartaoLabel = (v) => (v === 'fisico' ? 'Cartão físico' : 'Cartão virtual');

/** Aviso de prazo mostrado (e repetido ao aprovador) quando o cartão é físico. */
export const PRAZO_CARTAO_FISICO = 'Estimativa de 10 dias úteis para entrega.';

/**
 * O mesmo aviso para o virtual. Existe porque a ausência dele fazia o prazo
 * parecer resposta só do físico: quem pedia virtual não tinha ideia se era na
 * hora ou na mesma semana, e perguntava ao Financeiro.
 */
export const PRAZO_CARTAO_VIRTUAL = 'Liberado em até 48h.';

export const getSolicitacaoFin = (slug) => SOLICITACOES_FIN.find((s) => s.slug === slug);
export const getSolicitacaoFinPorTipo = (tipoDb) => SOLICITACOES_FIN.find((s) => s.tipoDb === tipoDb);

/**
 * Categorias de "Aplicação" do cartão (a antiga lista de CNAE; dedup: "causa
 * social" unificado em "Causas sociais"). Ordem alfabética, com "Outros" ao final.
 * No Cartão Virtual a escolha é MÚLTIPLA (coluna aplicacao text[]).
 */
export const APLICACOES = [
  'Alimentação',
  'Aluguel de veículo',
  'Assinatura',
  'Bares ou bebidas',
  'Causas sociais',
  'Combustíveis',
  'Comunicação',
  'Comércio digital',
  'Construção e serviços',
  'Educação',
  'Eletrônico',
  'Entretenimento',
  'Imóveis',
  'Joias e cassinos',
  'Lojas de varejo',
  'Lojas de especiarias',
  'Materiais de escritórios',
  'Pagamentos do governo',
  'Produtos têxteis',
  'Publicidade digital',
  'Saúde',
  'Serviços digitais',
  'Serviços profissionais',
  'Outros',
];

// ============================ Áreas do Financeiro ============================

/**
 * As duas rotinas do módulo, na escolha que o card "Financeiro" da Home abre
 * (FinanceiroModal.jsx) — mesmo desenho do card "Programas".
 *
 * São duas coisas diferentes, e é por isso que a escolha vem antes de entrar:
 * CARTÃO é dinheiro da empresa adiantado num cartão; REEMBOLSO é dinheiro que
 * a pessoa já gastou do próprio bolso e quer de volta. Quem chega no card sabe
 * qual das duas quer — o que não sabia era em qual metade do módulo ela mora.
 *
 * `modulo` é a chave do acesso em `modules`: cada área tem gate próprio
 * (reembolso_profiles é independente do acesso ao Financeiro), então o modal
 * mostra só o que a pessoa pode abrir.
 */
export const AREAS_FINANCEIRO = [
  {
    slug: 'cartoes',
    modulo: 'financeiro',
    label: 'Cartões Clara',
    icon: CreditCard,
    desc: 'Peça um cartão, acompanhe limites e veja os cartões que já são seus.',
    href: '/financeiro',
    cta: 'Abrir cartões',
  },
  {
    slug: 'reembolsos',
    modulo: 'reembolso',
    label: 'Reembolso',
    icon: Receipt,
    desc: 'Peça de volta o que você gastou do próprio bolso e acompanhe o pagamento.',
    href: '/reembolsos',
    cta: 'Abrir reembolsos',
  },
];

/** Só as áreas que a pessoa pode abrir. Vazio = card travado na Home. */
export const areasFinanceiroDe = (modules) =>
  AREAS_FINANCEIRO.filter((a) => Boolean(modules?.[a.modulo]));
