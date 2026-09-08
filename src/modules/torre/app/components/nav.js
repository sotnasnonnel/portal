import { LayoutGrid, ListChecks, Grid3x3 } from 'lucide-react';

// Navegação da Torre de Controle. Três telas de LEITURA, e mais nada: o Mapa
// (a matriz de bolinhas, que é como a reunião abre), o Quadro (por situação) e
// as Etapas (a mesma coisa em lista, para conferir item a item). Qualquer item
// a mais aqui seria um caminho para editar, que é justamente o que ele não faz.
export function navSections() {
  return [
    {
      label: 'Consulta',
      group: true,
      key: 'consulta',
      Icon: LayoutGrid,
      items: [
        { label: 'Mapa', href: '/torre/mapa', Icon: Grid3x3 },
        { label: 'Quadro', href: '/torre/quadro', Icon: LayoutGrid },
        { label: 'Etapas', href: '/torre/etapas', Icon: ListChecks },
      ],
    },
  ];
}

export const rotaInicialTorre = '/torre/mapa';
