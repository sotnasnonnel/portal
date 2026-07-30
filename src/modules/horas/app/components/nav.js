import {
  Clock,
  BarChart3,
  ListChecks,
  Settings,
  Users,
  FilePlus2,
  FileClock,
  CheckSquare,
  ShieldAlert,
  ScrollText,
  Banknote,
} from 'lucide-react';
import { isGestao } from '../../lib/roles';

// Navegação por papel. A gestão (gestor/coordenador) aponta E administra/enxerga
// a equipe; o usuário só aponta e vê o próprio tempo. A seção "Horas Extras" é o
// fluxo de solicitação/aprovação — todo mundo pede, a gestão aprova e o DP trata.
// (Fica fora do Sidebar.jsx para não quebrar o fast refresh: um arquivo de
// componente só deve exportar componentes.)
export function navSections(role, { dp = false } = {}) {
  const extras = [
    { label: 'Nova Solicitação', href: '/horas/extras/nova', Icon: FilePlus2 },
    { label: 'Minhas Solicitações', href: '/horas/extras/minhas', Icon: FileClock },
  ];
  // Aprovações aparecem para a gestão e para o DP. Quem é aprovador sem ter o
  // papel de gestão chega pelo link do e-mail — a rota não depende do menu.
  if (isGestao(role) || dp) {
    extras.push({ label: 'Aprovações Pendentes', href: '/horas/extras/aprovacoes', Icon: CheckSquare });
  }
  if (dp) {
    extras.push(
      { label: 'Painel DP', href: '/horas/extras/dp', Icon: Banknote },
      { label: 'Central de Exceções', href: '/horas/extras/excecoes', Icon: ShieldAlert },
      { label: 'Auditoria', href: '/horas/extras/auditoria', Icon: ScrollText }
    );
  }

  if (isGestao(role)) {
    return [
      { label: 'Apontamento', items: [{ label: 'Apontar', href: '/horas/apontar', Icon: Clock }] },
      {
        label: 'Gestão',
        items: [
          { label: 'Dashboard da Equipe', href: '/horas/dashboard', Icon: BarChart3 },
          { label: 'Configuração', href: '/horas/config', Icon: Settings },
          { label: 'Equipe', href: '/horas/equipe', Icon: Users },
          { label: 'Registros', href: '/horas/registros', Icon: ListChecks },
        ],
      },
      { label: 'Horas Extras', items: extras },
    ];
  }
  return [
    {
      label: 'Menu',
      items: [
        { label: 'Apontar', href: '/horas/apontar', Icon: Clock },
        { label: 'Meu Dashboard', href: '/horas/dashboard', Icon: BarChart3 },
        { label: 'Meus Registros', href: '/horas/registros', Icon: ListChecks },
      ],
    },
    { label: 'Horas Extras', items: extras },
  ];
}

// Primeira rota permitida ao papel (destino do índice e dos redirecionamentos).
export function rotaInicial(role) {
  return navSections(role)[0].items[0].href;
}
