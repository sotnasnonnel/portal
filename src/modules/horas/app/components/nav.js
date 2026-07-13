import { Clock, BarChart3, ListChecks, Settings, Users } from 'lucide-react';
import { isGestao } from '../../lib/roles';

// Navegação por papel. A gestão (gestor/coordenador) aponta E administra/enxerga
// a equipe; o usuário só aponta e vê o próprio tempo.
// (Fica fora do Sidebar.jsx para não quebrar o fast refresh: um arquivo de
// componente só deve exportar componentes.)
export function navSections(role) {
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
  ];
}

// Primeira rota permitida ao papel (destino do índice e dos redirecionamentos).
export function rotaInicial(role) {
  return navSections(role)[0].items[0].href;
}
