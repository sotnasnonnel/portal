import { FilePlus2, ClipboardList, ClipboardCheck, Inbox, LayoutGrid, Settings2, Workflow, Star } from 'lucide-react';

// Navegação da sidebar do Administrativo. Fica fora do Sidebar.jsx para não
// quebrar o fast refresh (um arquivo de componente só deve exportar componentes).
//
// O módulo é aberto a todos os logados: abrir e acompanhar não têm gate. A fila
// do time do Adm e as aprovações entram aqui quando essas telas existirem.
export function navSections({ isAdmin = false, isTime = false } = {}) {
  const secoes = [
    {
      label: 'Menu',
      items: [
        { label: 'Abrir chamado', href: '/administrativo/novo', Icon: FilePlus2 },
        { label: 'Meus chamados', href: '/administrativo/meus', Icon: ClipboardList },
        // Quadro é de todos: o solicitante enxerga onde o pedido dele está, e a
        // RLS limita o que cada um vê.
        { label: 'Quadro', href: '/administrativo/kanban', Icon: LayoutGrid },
        // Aparece para todos: qualquer pessoa pode ser superior de alguém, e a
        // tela se explica sozinha quando não há nada pendente.
        { label: 'Aprovações', href: '/administrativo/aprovacoes', Icon: ClipboardCheck },
      ],
    },
  ];
  // A fila é do time do Adm (atendente e admin): é onde os chamados são
  // trabalhados. Quem só abre chamado não tem o que fazer nela.
  if (isTime) {
    secoes.push({
      label: 'Atendimento',
      items: [{ label: 'Fila', href: '/administrativo/fila', Icon: Inbox }],
    });
  }
  if (isAdmin) {
    secoes.push({
      label: 'Administração',
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
