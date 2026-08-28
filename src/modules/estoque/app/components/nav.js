import {
  Boxes, BarChart3, ArrowDownToLine, ArrowUpFromLine, ClipboardCheck, History, FileSpreadsheet,
} from 'lucide-react';

// Navegação da sidebar do Estoque. Fica fora do Sidebar.jsx para não quebrar o
// fast refresh (um arquivo de componente só deve exportar componentes).
//
// Consultar é de todo mundo: quem atende um chamado precisa saber se tem o item
// antes de prometer. Movimentar é só do operador (administrativo_role), e a RLS
// é quem realmente barra — esconder o item aqui só evita o clique que daria erro.
export function navSections({ operador = false } = {}) {
  const secoes = [
    {
      label: 'Menu',
      items: [
        { label: 'Posição de estoque', href: '/estoque/posicao', Icon: Boxes },
        { label: 'Indicadores', href: '/estoque/dashboard', Icon: BarChart3 },
        { label: 'Movimentações', href: '/estoque/movimentos', Icon: History },
      ],
    },
  ];

  if (operador) {
    secoes.push({
      label: 'Movimentar',
      items: [
        { label: 'Entrada', href: '/estoque/entrada', Icon: ArrowDownToLine },
        { label: 'Saída', href: '/estoque/saida', Icon: ArrowUpFromLine },
        { label: 'Inventário', href: '/estoque/ajuste', Icon: ClipboardCheck },
      ],
    });
    secoes.push({
      label: 'Administração',
      items: [
        { label: 'Importar planilha', href: '/estoque/importar', Icon: FileSpreadsheet },
      ],
    });
  }

  return secoes;
}

// Primeira rota do módulo (destino do índice e de redirecionamentos).
export const rotaInicialEstoque = '/estoque/posicao';
