import { ClipboardList, UserPlus, FileText, Network, Wallet, TrendingUp, UserMinus } from 'lucide-react';

/**
 * Fonte única das requisições do gestor.
 * - slug: usado na URL /gestor/solicitacoes/nova/:slug
 * - desc: subtítulo opcional exibido no card
 * - status: 'pronto' (tem formulário) | 'em_breve' (abre placeholder)
 * - tipoDb: valor da coluna `tipo` em solicitacoes_rh (só p/ requisições prontas)
 */
export const REQUISICOES = [
  { slug: 'mapeamento', label: 'Mapeamento', desc: 'Avaliação de Candidatos / Projetos', icon: ClipboardList, status: 'pronto', tipoDb: 'mapeamento' },
  { slug: 'nova-vaga', label: 'Nova Vaga', icon: UserPlus, status: 'pronto', tipoDb: 'nova_vaga' },
  { slug: 'formulario-contratacao', label: 'Formulário de Contratação', icon: FileText, status: 'pronto', tipoDb: 'formulario_contratacao' },
  { slug: 'consulta-organograma', label: 'Consulta Organograma', icon: Network, status: 'pronto' },
  { slug: 'ajuda-custo', label: 'Ajuda de Custo', icon: Wallet, status: 'pronto', tipoDb: 'ajuda_custo' },
  { slug: 'alteracao', label: 'Alteração de Cargo / Função', icon: TrendingUp, status: 'pronto', tipoDb: 'aumento_salario' },
  { slug: 'desligamento', label: 'Desligamento', icon: UserMinus, status: 'pronto', tipoDb: 'desligamento' },
];

export const getRequisicao = (slug) => REQUISICOES.find((r) => r.slug === slug);
