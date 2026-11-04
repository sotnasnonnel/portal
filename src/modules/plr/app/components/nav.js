import { Calculator, PencilLine, Target } from 'lucide-react';

// Navegação do PLR: a consulta (para todo mundo que entra) e, para o admin, a
// edição dos números. Quem não edita não vê o item — e a rota também barra.
// O mesmo item do resultado vira "Meu PLR" para quem só vê a própria linha.
export function navSections({ podeEditar = false, veSetores = true, veTodos = false } = {}) {
  return [
    {
      label: 'Consulta',
      key: 'consulta',
      items: [
        veSetores && { label: 'Metas por setor', href: '/plr/setores', Icon: Target },
        { label: veTodos ? 'Resultado por pessoa' : 'Meu PLR', href: '/plr/resultado', Icon: Calculator },
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
