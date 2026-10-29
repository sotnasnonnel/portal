import { Target, PencilLine } from 'lucide-react';

// Navegação do PLR: a consulta (para todo mundo que entra) e, para o admin, a
// edição dos números. Quem não edita não vê o item — e a rota também barra.
export function navSections({ podeEditar = false } = {}) {
  return [
    {
      label: 'Consulta',
      key: 'consulta',
      items: [
        { label: 'Metas por setor', href: '/plr/setores', Icon: Target },
      ],
    },
    podeEditar && {
      label: 'Administração',
      key: 'admin',
      items: [
        { label: 'Editar resultados', href: '/plr/editar', Icon: PencilLine },
      ],
    },
  ].filter(Boolean);
}

export const rotaInicialPlr = '/plr/setores';
