import { LayoutDashboard, FileText, ClipboardCheck, Workflow } from 'lucide-react';
import { SOLICITACOES_FIN } from '../../../../config/financeiro';

// Navegação da sidebar do Financeiro. Fica fora do Sidebar.jsx para não quebrar
// o fast refresh (um arquivo de componente só deve exportar componentes).
// - canAbrir: coordenador/gestor (abrem solicitações).
// - isAdmin: time do Financeiro (configura fluxos, executa).
export function navSections({ canAbrir = false, isAdmin = false } = {}) {
  const solicitacoes = [
    ...(canAbrir
      ? SOLICITACOES_FIN.map((s) => ({ label: s.curto, href: `/financeiro/solicitacoes/nova/${s.slug}`, Icon: s.icon }))
      : []),
    { label: 'Acompanhar', href: '/financeiro/solicitacoes/acompanhar', Icon: ClipboardCheck },
  ];

  const secoes = [
    { label: 'Menu', items: [{ label: 'Dashboard', href: '/financeiro/dashboard', Icon: LayoutDashboard }] },
    { label: 'Solicitações', group: true, key: 'solicitacoes', Icon: FileText, items: solicitacoes },
  ];

  if (isAdmin) {
    secoes.push({ label: 'Administração', items: [{ label: 'Fluxos de Aprovação', href: '/financeiro/fluxos', Icon: Workflow }] });
  }
  return secoes;
}

// Primeira rota do módulo (destino do índice e de redirecionamentos).
export const rotaInicialFin = '/financeiro/dashboard';
