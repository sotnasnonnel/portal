import { Boxes, ClipboardList, LayoutDashboard, Lightbulb, Rocket, Target } from 'lucide-react';

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
// O menu mostra SÓ O PROGRAMA EM QUE SE ESTÁ. Com os dois listados, metade do
// menu era de um programa em que a pessoa não estava — e a escolha entre eles
// já acontece antes, no modal do card "Programas" da Home.
const PROGRAMA_NAV = {
  ideias: {
    participar: [{ label: 'Campo de Ideias', href: '/programas/ideias', Icon: Lightbulb }],
    painel: { label: 'Painel da Inovação', href: '/programas/dashboard', Icon: LayoutDashboard },
  },
  // Consulta, não participação: por isso entra sem painel — os números dela
  // são os do módulo Inovação, no backoffice, e não se remontam aqui.
  iniciativas: {
    participar: [
      { label: 'Iniciativas em uso', href: '/programas/iniciativas', Icon: Boxes },
      // Rótulo depende de quem olha: o admin vê a fila da empresa, os outros
      // veem a própria. Mesma tela, mesma consulta — quem separa é a RLS.
      { label: 'Pedidos', href: '/programas/pedidos', Icon: ClipboardList, labelAdmin: 'Pedidos recebidos' },
    ],
    painel: null,
  },
  alavanca: {
    participar: [{ label: 'Alavanca PHD', href: '/programas/alavanca', Icon: Rocket }],
    // O Painel da Alavanca tem dono — a planilha é explícita ("**Apenas para o
    // time comercial") —, então só aparece para o comercial.
    painel: { label: 'Painel da Alavanca', href: '/programas/painel-alavanca', Icon: Target },
    soComercial: true,
  },
};

/** Qual programa a rota atual pertence. `null` na tela de escolha. */
export function programaDaRota(pathname = '') {
  if (pathname.startsWith('/programas/alavanca') || pathname.startsWith('/programas/painel-alavanca')) {
    return 'alavanca';
  }
  if (pathname.startsWith('/programas/ideias') || pathname.startsWith('/programas/dashboard')) {
    return 'ideias';
  }
  if (pathname.startsWith('/programas/iniciativas') || pathname.startsWith('/programas/pedidos')) {
    return 'iniciativas';
  }
  return null;
}

export function navSections({ ehComercial = false, ehAdmin = false, programa = null } = {}) {
  // Fora de um programa (a tela de escolha), o menu lista os dois: é o único
  // momento em que não dá para saber para onde a pessoa vai.
  const chaves = programa ? [programa] : Object.keys(PROGRAMA_NAV);

  const participar = chaves
    .flatMap((k) => PROGRAMA_NAV[k].participar)
    .map(({ labelAdmin, ...item }) => (
      ehAdmin && labelAdmin ? { ...item, label: labelAdmin } : item
    ));
  const paineis = chaves
    .filter((k) => PROGRAMA_NAV[k].painel)
    .filter((k) => !PROGRAMA_NAV[k].soComercial || ehComercial)
    .map((k) => PROGRAMA_NAV[k].painel);

  const secoes = [
    {
      label: 'Participar',
      group: true,
      key: 'participar',
      Icon: Lightbulb,
      items: participar,
    },
  ];

  // Sem painel visível (Alavanca para quem não é do comercial), o grupo sai —
  // um grupo vazio no menu só dá a impressão de que algo não carregou.
  if (paineis.length) {
    secoes.push({
      label: 'Dashboard',
      group: true,
      key: 'dashboard',
      Icon: LayoutDashboard,
      items: paineis,
    });
  }

  return secoes;
}

// Primeira rota do módulo (destino do índice e de redirecionamentos).
export const rotaInicialProgramas = '/programas/inicio';
