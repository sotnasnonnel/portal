import {
  FilePlus2, ClipboardList, ClipboardCheck, Inbox, LayoutGrid, Settings2, Workflow, Star,
  BarChart3, Headset,
} from 'lucide-react';

// Navegação da sidebar do Administrativo, na divisão padrão do portal (mesma do
// Financeiro): grupos colapsáveis para o dia a dia + seção simples de
// Administração. Fica fora do Sidebar.jsx para não quebrar o fast refresh
// (um arquivo de componente só deve exportar componentes).
//
// O módulo é aberto a todos os logados: abrir e acompanhar não têm gate.
// CHAMADOS  -> o que EU faço (abrir e ver os meus).
// ACOMPANHAR-> onde os chamados estão (quadro, fila, aprovações, indicadores);
//              a RLS é quem limita o conteúdo — quem não é do time do Adm
//              enxerga só os próprios chamados.
export function navSections({ isAdmin = false } = {}) {
  const secoes = [
    {
      label: 'Chamados',
      group: true,
      key: 'chamados',
      Icon: Headset,
      items: [
        { label: 'Abrir chamado', href: '/administrativo/novo', Icon: FilePlus2 },
        { label: 'Meus chamados', href: '/administrativo/meus', Icon: ClipboardList },
      ],
    },
    {
      label: 'Acompanhamento',
      group: true,
      key: 'acompanhamento',
      Icon: LayoutGrid,
      items: [
        // Quadro é de todos: o solicitante enxerga onde o pedido dele está.
        { label: 'Quadro', href: '/administrativo/kanban', Icon: LayoutGrid },
        // Aparece para todos: qualquer pessoa pode ser superior de alguém, e a
        // tela se explica sozinha quando não há nada pendente.
        { label: 'Aprovações', href: '/administrativo/aprovacoes', Icon: ClipboardCheck },
        { label: 'Fila', href: '/administrativo/fila', Icon: Inbox },
        { label: 'Indicadores', href: '/administrativo/dashboard', Icon: BarChart3 },
      ],
    },
  ];
  if (isAdmin) {
    secoes.push({
      label: 'Administração',
      key: 'admin',
      items: [
        { label: 'Configuração', href: '/administrativo/config', Icon: Settings2 },
        { label: 'Fluxos de Aprovação', href: '/administrativo/fluxos', Icon: Workflow },
        { label: 'Satisfação', href: '/administrativo/satisfacao', Icon: Star },
      ],
    });
  }
  return secoes;
}

// Primeira rota do módulo (destino do índice e de redirecionamentos).
export const rotaInicialAdm = '/administrativo/novo';
