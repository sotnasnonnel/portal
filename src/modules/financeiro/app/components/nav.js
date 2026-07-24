import { LayoutDashboard, FileText, ClipboardCheck, Workflow, Receipt, Wallet } from 'lucide-react';
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

  const secoes = temFinanceiro
    ? [
        { label: 'Menu', items: [{ label: 'Dashboard', href: '/financeiro/dashboard', Icon: LayoutDashboard }] },
        { label: 'Solicitações', group: true, key: 'solicitacoes', Icon: FileText, items: solicitacoes },
      ]
    : [];

  // Reembolsos e adiantamentos são solicitações do Financeiro, mas mantêm rotas
  // e permissão próprias — por isso entram como grupo à parte.
  if (temReembolso) {
    secoes.push({
      label: 'Reembolsos',
      group: true,
      key: 'reembolsos',
      Icon: Receipt,
      items: [
        // "Solicitações" e não "Reembolsos": dentro do grupo homônimo o rótulo
        // repetido ficava redundante.
        { label: 'Solicitações', href: '/reembolsos', Icon: Receipt },
        { label: 'Adiantamentos', href: '/adiantamentos', Icon: Wallet },
      ],
    });
  }

  if (isAdmin) {
    secoes.push({ label: 'Administração', items: [{ label: 'Fluxos de Aprovação', href: '/financeiro/fluxos', Icon: Workflow }] });
  }
  return secoes;
}

// Primeira rota do módulo (destino do índice e de redirecionamentos).
export const rotaInicialFin = '/financeiro/dashboard';
