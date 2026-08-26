import { Boxes, LayoutDashboard, Lightbulb, Rocket, Target } from 'lucide-react';

// Navegação da sidebar dos Programas. Fica fora do Sidebar.jsx para não quebrar
// o fast refresh (um arquivo de componente só deve exportar componentes).
//
// "Dashboard" é item próprio de menu porque é assim que a planilha organiza o
// Campo de Ideias: 1) os dois cards, 2) e 3) os formulários, 4) o Dashboard.
// "Campo de Ideias" leva aos cards de registro; "Dashboard" ao painel.
//
// O módulo é aberto a todos os logados. O que tem dono é o PAINEL DA ALAVANCA —
// a planilha é explícita ("**Apenas para o time comercial").
export function navSections({ ehComercial = false } = {}) {
  const secoes = [
    {
      label: 'Menu',
      items: [
        { label: 'Dashboard', href: '/programas/dashboard', Icon: LayoutDashboard },
        { label: 'Programas', href: '/programas/inicio', Icon: Boxes },
        { label: 'Campo de Ideias', href: '/programas/ideias', Icon: Lightbulb },
        { label: 'Alavanca PHD', href: '/programas/alavanca', Icon: Rocket },
      ],
    },
  ];
  if (ehComercial) {
    secoes.push({
      label: 'Comercial',
      items: [
        { label: 'Painel da Alavanca', href: '/programas/painel-alavanca', Icon: Target },
      ],
    });
  }
  return secoes;
}

// Primeira rota do módulo (destino do índice e de redirecionamentos).
export const rotaInicialProgramas = '/programas/inicio';
