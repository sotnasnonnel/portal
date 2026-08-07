import { FilePlus2, ClipboardList, ClipboardCheck, Settings2 } from 'lucide-react';

// Navegação da sidebar do Administrativo. Fica fora do Sidebar.jsx para não
// quebrar o fast refresh (um arquivo de componente só deve exportar componentes).
//
// O módulo é aberto a todos os logados: abrir e acompanhar não têm gate. A fila
// do time do Adm e as aprovações entram aqui quando essas telas existirem.
export function navSections({ isAdmin = false } = {}) {
  const secoes = [
    {
      label: 'Menu',
      items: [
        { label: 'Abrir chamado', href: '/administrativo/novo', Icon: FilePlus2 },
        { label: 'Meus chamados', href: '/administrativo/meus', Icon: ClipboardList },
        // Aparece para todos: qualquer pessoa pode ser superior de alguém, e a
        // tela se explica sozinha quando não há nada pendente.
        { label: 'Aprovações', href: '/administrativo/aprovacoes', Icon: ClipboardCheck },
      ],
    },
  ];
  if (isAdmin) {
    secoes.push({
      label: 'Administração',
      items: [{ label: 'Configuração', href: '/administrativo/config', Icon: Settings2 }],
    });
  }
  return secoes;
}

// Primeira rota do módulo (destino do índice e de redirecionamentos).
export const rotaInicialAdm = '/administrativo/novo';
