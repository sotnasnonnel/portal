import { Clock, BarChart3, ListChecks, Settings, Users } from 'lucide-react';
import { isDiretoria, isGerente } from '../../lib/roles';

// Navegação por papel, em seções — mesma estrutura do protótipo.
// A diretoria supervisiona e não tem "Apontar"; o gerente é o papel híbrido.
// (Fica fora do Sidebar.jsx para não quebrar o fast refresh: um arquivo de
// componente só deve exportar componentes.)
export function navSections(role) {
  if (isDiretoria(role)) {
    return [
      { label: 'Visão Geral', items: [{ label: 'Dashboard Geral', href: '/horas/dashboard', Icon: BarChart3 }] },
      {
        label: 'Administração',
        items: [
          { label: 'Configurações', href: '/horas/config', Icon: Settings },
          { label: 'Gerências & Equipe', href: '/horas/equipe', Icon: Users },
          { label: 'Registros', href: '/horas/registros', Icon: ListChecks },
        ],
      },
    ];
  }
  if (isGerente(role)) {
    return [
      { label: 'Apontamento', items: [{ label: 'Apontar', href: '/horas/apontar', Icon: Clock }] },
      {
        label: 'Gestão',
        items: [
          { label: 'Dashboard da Gerência', href: '/horas/dashboard', Icon: BarChart3 },
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
