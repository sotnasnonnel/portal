import {
  LayoutGrid, ListChecks, FolderKanban, BarChart3, Settings2, Radar, Building2, Route,
} from 'lucide-react';

// Navegação da sidebar da Mobilização, na divisão padrão do portal (mesma do
// Administrativo): grupos colapsáveis para o dia a dia + seção simples de
// Administração. Fica fora do Sidebar.jsx para não quebrar o fast refresh
// (um arquivo de componente só deve exportar componentes).
//
// ACOMPANHAMENTO -> onde os processos estão. Aberto a todos, como no Adm: a RLS
//                   é quem limita o conteúdo, então quem não é do time enxerga
//                   só os processos em que está envolvido.
// PROCESSOS      -> abrir mobilização da empresa (gatilho manual) e a lista.
// ADMINISTRAÇÃO  -> catálogo de etapas e SLAs. Só o admin do Adm.
export function navSections({ isTime = false, isAdmin = false } = {}) {
  const secoes = [
    {
      label: 'Acompanhamento',
      group: true,
      key: 'acompanhamento',
      Icon: LayoutGrid,
      items: [
        { label: 'Quadro', href: '/mobilizacao/kanban', Icon: LayoutGrid },
        { label: 'Etapas', href: '/mobilizacao/fila', Icon: ListChecks },
        { label: 'Processos', href: '/mobilizacao/processos', Icon: FolderKanban },
        { label: 'Indicadores', href: '/mobilizacao/dashboard', Icon: BarChart3 },
      ],
    },
  ];

  // Só a mobilização de EMPRESA se abre à mão — as de pessoa nascem do chamado
  // do Adm, e um segundo caminho para a mesma coisa criaria dois processos para
  // a mesma pessoa, sem nada que os ligasse.
  if (isTime) {
    secoes[0].items.push({ label: 'Torre de controle', href: '/mobilizacao/torre', Icon: Radar });
    secoes.push({
      label: 'Processos',
      group: true,
      key: 'processos',
      Icon: Route,
      items: [
        { label: 'Mobilizar empresa', href: '/mobilizacao/nova', Icon: Building2 },
      ],
    });
  }

  if (isAdmin) {
    secoes.push({
      label: 'Administração',
      key: 'admin',
      items: [
        { label: 'Catálogo e SLAs', href: '/mobilizacao/catalogo', Icon: Settings2 },
      ],
    });
  }

  return secoes;
}

// Primeira rota do módulo (destino do índice e de redirecionamentos).
// O quadro, e não a abertura: quase todo mundo entra aqui para ATUALIZAR um
// passo, não para abrir processo.
export const rotaInicialMobilizacao = '/mobilizacao/kanban';
