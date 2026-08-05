import { FilePlus2, ClipboardList } from 'lucide-react';

// Navegação da sidebar do Administrativo. Fica fora do Sidebar.jsx para não
// quebrar o fast refresh (um arquivo de componente só deve exportar componentes).
//
// O módulo é aberto a todos os logados: abrir e acompanhar não têm gate. A fila
// do time do Adm e as aprovações entram aqui quando essas telas existirem.
export function navSections() {
  return [
    {
      label: 'Menu',
      items: [
        { label: 'Abrir chamado', href: '/administrativo/novo', Icon: FilePlus2 },
        { label: 'Meus chamados', href: '/administrativo/meus', Icon: ClipboardList },
      ],
    },
  ];
}

// Primeira rota do módulo (destino do índice e de redirecionamentos).
export const rotaInicialAdm = '/administrativo/novo';
