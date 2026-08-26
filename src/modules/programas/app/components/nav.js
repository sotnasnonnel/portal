import { Boxes, LayoutDashboard, Lightbulb, Rocket, Target } from 'lucide-react';

// Navegação da sidebar dos Programas. Fica fora do Sidebar.jsx para não quebrar
// o fast refresh (um arquivo de componente só deve exportar componentes).
//
// A divisão do menu é a mesma nos dois programas, e é o que dá para prever
// onde clicar:
//   PARTICIPAR -> "Campo de Ideias" e "Alavanca PHD": os botões de registrar e
//                 o acompanhamento do que EU registrei.
//   LER        -> "Dashboard" e "Painel da Alavanca": os números do programa.
// Registrar nunca mora numa tela de números.
//
// O módulo é aberto a todos os logados. O que tem dono é o PAINEL DA ALAVANCA —
// a planilha é explícita ("**Apenas para o time comercial").
export function navSections({ ehComercial = false } = {}) {
  const secoes = [
    {
      label: 'Menu',
      items: [
        { label: 'Dashboard', href: '/programas/dashboard', Icon: LayoutDashboard },
        { label: 'Campo de Ideias', href: '/programas/ideias', Icon: Lightbulb },
        { label: 'Alavanca PHD', href: '/programas/alavanca', Icon: Rocket },
        { label: 'Programas', href: '/programas/inicio', Icon: Boxes },
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
