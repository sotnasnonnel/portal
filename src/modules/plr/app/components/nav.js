import { Calculator, PencilLine, Target } from 'lucide-react';

// Navegação do PLR: a consulta (para todo mundo que entra) e, para o admin, a
// edição dos números. Quem não edita não vê o item — e a rota também barra.
export function navSections({ podeEditar = false, veSetores = true } = {}) {
  return [
    {
      label: 'Consulta',
      key: 'consulta',
      items: [
        veSetores && { label: 'Metas por setor', href: '/plr/setores', Icon: Target },
        { label: 'Resultado por pessoa', href: '/plr/resultado', Icon: Calculator },
      ].filter(Boolean),
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
