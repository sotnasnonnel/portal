import { Boxes, LayoutDashboard, Lightbulb, Rocket, Target } from 'lucide-react';

// Navegação da sidebar dos Programas, na divisão padrão do portal (grupos
// colapsáveis, como no Financeiro). Fica fora do Sidebar.jsx para não quebrar o
// fast refresh (um arquivo de componente só deve exportar componentes).
//
// A divisão do menu é a mesma nos dois programas, e é o que dá para prever
// onde clicar:
//   Participar -> registrar e acompanhar o que é meu.
//   Dashboard  -> os números de cada programa.
// Registrar nunca mora numa tela de números.
//
// O grupo Dashboard junta os painéis. O Painel da Alavanca tem dono — a
// planilha é explícita ("**Apenas para o time comercial") —, então para quem
// não é do comercial o grupo fica só com o Painel da Inovação.
export function navSections({ ehComercial = false } = {}) {
  const paineis = [
    { label: 'Painel da Inovação', href: '/programas/dashboard', Icon: LayoutDashboard },
  ];
  if (ehComercial) {
    paineis.push({ label: 'Painel da Alavanca', href: '/programas/painel-alavanca', Icon: Target });
  }

  return [
    {
      label: 'Participar',
      group: true,
      key: 'participar',
      Icon: Lightbulb,
      items: [
        { label: 'Programas', href: '/programas/inicio', Icon: Boxes },
        { label: 'Campo de Ideias', href: '/programas/ideias', Icon: Lightbulb },
        { label: 'Alavanca PHD', href: '/programas/alavanca', Icon: Rocket },
      ],
    },
    {
      label: 'Dashboard',
      group: true,
      key: 'dashboard',
      Icon: LayoutDashboard,
      items: paineis,
    },
  ];
}

// Primeira rota do módulo (destino do índice e de redirecionamentos).
export const rotaInicialProgramas = '/programas/inicio';
