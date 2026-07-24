import { LayoutDashboard, FileText, ClipboardCheck, Workflow, Receipt } from 'lucide-react';
import { SOLICITACOES_FIN } from '../../../../config/financeiro';

// Navegação da sidebar do Financeiro. Fica fora do Sidebar.jsx para não quebrar
// o fast refresh (um arquivo de componente só deve exportar componentes).
// - canAbrir: coordenador/gestor (abrem solicitações).
// - isAdmin: time do Financeiro (configura fluxos, executa).
// - temFinanceiro: acesso ao módulo Financeiro em si. Quem tem só o Reembolso
//   navega por aqui, então as seções do Financeiro não podem aparecer para ele.
// - temReembolso: acesso ao módulo de Reembolsos, que tem gate próprio
//   (reembolso_profiles) independente do acesso ao Financeiro.
export function navSections({ canAbrir = false, isAdmin = false, temFinanceiro = false, temReembolso = false } = {}) {
  const solicitacoes = [
    ...(canAbrir
      ? SOLICITACOES_FIN.map((s) => ({ label: s.curto, href: `/financeiro/solicitacoes/nova/${s.slug}`, Icon: s.icon }))
      : []),
    { label: 'Acompanhar', href: '/financeiro/solicitacoes/acompanhar', Icon: ClipboardCheck },
  ];

  // Destinos diretos. Reembolsos entra aqui como item simples (sem submenu) e
  // pode aparecer sozinho, já que tem gate próprio.
  const menu = [
    ...(temFinanceiro ? [{ label: 'Dashboard', href: '/financeiro/dashboard', Icon: LayoutDashboard }] : []),
    ...(temReembolso ? [{ label: 'Reembolsos', href: '/reembolsos', Icon: Receipt }] : []),
  ];

  const secoes = [];
  if (menu.length) secoes.push({ label: 'Menu', items: menu });
  if (temFinanceiro) {
    secoes.push({ label: 'Solicitações', group: true, key: 'solicitacoes', Icon: FileText, items: solicitacoes });
  }

  if (isAdmin) {
    secoes.push({ label: 'Administração', items: [{ label: 'Fluxos de Aprovação', href: '/financeiro/fluxos', Icon: Workflow }] });
  }
  return secoes;
}

// Primeira rota do módulo (destino do índice e de redirecionamentos).
export const rotaInicialFin = '/financeiro/dashboard';
