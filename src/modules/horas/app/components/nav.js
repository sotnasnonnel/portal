import {
  Clock,
  BarChart3,
  ListChecks,
  Settings,
  SlidersHorizontal,
  Users,
  FilePlus2,
  FileClock,
  CheckSquare,
} from 'lucide-react';
import { isGestao, podeConfigurarApontamento } from '../../lib/roles';

// Navegação por papel. A gestão (gestor/coordenador) aponta E administra/enxerga
// a equipe; o usuário só aponta e vê o próprio tempo.
// "Config. do Apontamento" foge do papel: é uma curadoria central, restrita a
// uma lista nominal (daí o `user` além do `role`).
// A seção "Horas Extras" aqui é só a ponta do fluxo que o colaborador e o gestor
// usam (pedir, acompanhar, aprovar). O tratamento do DP — painel, exceções de
// prazo e auditoria — vive no módulo Gestão de Pessoas.
// (Fica fora do Sidebar.jsx para não quebrar o fast refresh: um arquivo de
// componente só deve exportar componentes.)
export function navSections(role, user) {
  const extras = [
    { label: 'Nova Solicitação', href: '/horas/extras/nova', Icon: FilePlus2 },
    { label: 'Minhas Solicitações', href: '/horas/extras/minhas', Icon: FileClock },
  ];
  // Quem é aprovador sem ter o papel de gestão chega pelo link do e-mail — a
  // rota não depende do menu.
  if (isGestao(role)) {
    extras.push({ label: 'Solicitações Pendentes', href: '/horas/extras/aprovacoes', Icon: CheckSquare });
  }

  const configApontamento = podeConfigurarApontamento(user)
    ? [{ label: 'Config. do Apontamento', href: '/horas/config/apontamento', Icon: SlidersHorizontal }]
    : [];

  if (isGestao(role)) {
    return [
      { label: 'Apontamento', items: [{ label: 'Apontar', href: '/horas/apontar', Icon: Clock }] },
      {
        label: 'Gestão',
        items: [
          { label: 'Dashboard da Equipe', href: '/horas/dashboard', Icon: BarChart3 },
          { label: 'Configuração', href: '/horas/config', Icon: Settings, exato: true },
          ...configApontamento,
          { label: 'Equipe', href: '/horas/equipe', Icon: Users },
          { label: 'Registros', href: '/horas/registros', Icon: ListChecks },
        ],
      },
      { label: 'Horas Extras', items: extras },
    ];
  }
  // Quem configura o apontamento sem ter papel de gestão (não é o caso hoje, mas
  // a lista é nominal e independe do papel) também precisa do atalho.
  return [
    {
      label: 'Menu',
      items: [
        { label: 'Apontar', href: '/horas/apontar', Icon: Clock },
        { label: 'Meu Dashboard', href: '/horas/dashboard', Icon: BarChart3 },
        { label: 'Meus Registros', href: '/horas/registros', Icon: ListChecks },
        ...configApontamento,
      ],
    },
    { label: 'Horas Extras', items: extras },
  ];
}

// Primeira rota permitida ao papel (destino do índice e dos redirecionamentos).
export function rotaInicial(role) {
  return navSections(role)[0].items[0].href;
}
