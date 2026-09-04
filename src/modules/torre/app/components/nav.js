import { LayoutGrid, ListChecks } from 'lucide-react';

// Navegação da Torre de Controle. Duas telas e mais nada: o módulo existe para
// a reunião de torre, onde se olha o quadro e se confere a lista. Qualquer item
// a mais aqui seria um caminho para editar, que é justamente o que ele não faz.
export function navSections() {
  return [
    {
      label: 'Consulta',
      group: true,
      key: 'consulta',
      Icon: LayoutGrid,
      items: [
        { label: 'Quadro', href: '/torre/quadro', Icon: LayoutGrid },
        { label: 'Etapas', href: '/torre/etapas', Icon: ListChecks },
      ],
    },
  ];
}

export const rotaInicialTorre = '/torre/quadro';
