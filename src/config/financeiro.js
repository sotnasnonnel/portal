import { CreditCard, TrendingUp } from 'lucide-react';

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
