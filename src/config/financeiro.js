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
  { slug: 'cartao-virtual', label: 'Solicitação de Criação de Cartão Virtual', curto: 'Cartão Virtual', icon: CreditCard, status: 'pronto', tipoDb: 'cartao_virtual' },
  { slug: 'aumento-limite', label: 'Solicitação de Aumento de Limite', curto: 'Aumento de Limite', icon: TrendingUp, status: 'pronto', tipoDb: 'aumento_limite' },
];

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
