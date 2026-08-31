import {
  Boxes, BarChart3, ArrowDownToLine, ArrowUpFromLine, ClipboardCheck, History, PackageSearch,
} from 'lucide-react';

// Navegação da sidebar do Estoque, na divisão padrão do portal (mesma do
// Financeiro): grupos colapsáveis para o dia a dia + seção simples de
// Administração. Fica fora do Sidebar.jsx para não quebrar o fast refresh
// (um arquivo de componente só deve exportar componentes).
//
// CONSULTA   -> o que todo mundo pode ver. Quem atende um chamado precisa saber
//               se tem o item antes de prometer, então isso não tem gate.
// MOVIMENTAR -> só o operador (administrativo_role). A RLS é quem realmente
//               barra; esconder aqui só evita o clique que daria erro.
export function navSections({ operador = false } = {}) {
  const secoes = [
    {
      label: 'Consulta',
      group: true,
      key: 'consulta',
      Icon: PackageSearch,
      items: [
        { label: 'Posição de estoque', href: '/estoque/posicao', Icon: Boxes },
        { label: 'Movimentações', href: '/estoque/movimentos', Icon: History },
        { label: 'Indicadores', href: '/estoque/dashboard', Icon: BarChart3 },
      ],
    },
  ];

  if (operador) {
    secoes.push({
      label: 'Movimentar',
      group: true,
      key: 'movimentar',
      Icon: ArrowUpFromLine,
      items: [
        { label: 'Entrada', href: '/estoque/entrada', Icon: ArrowDownToLine },
        { label: 'Saída', href: '/estoque/saida', Icon: ArrowUpFromLine },
        { label: 'Inventário', href: '/estoque/ajuste', Icon: ClipboardCheck },
      ],
    });
  }

  return secoes;
}

// Primeira rota do módulo (destino do índice e de redirecionamentos).
export const rotaInicialEstoque = '/estoque/posicao';
