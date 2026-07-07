/**
 * Perfis do módulo DP e regras de hierarquia de cadastro.
 * - gestor: topo, sem superior.
 * - coordenador: responde a um gestor.
 * - usuario: responde a um gestor ou coordenador.
 * (admin não é atribuível pela UI de cadastro.)
 */
export const PERFIL_OPCOES = [
  { value: 'usuario', label: 'Usuário' },
  { value: 'coordenador', label: 'Coordenador' },
  { value: 'gestor', label: 'Gestor' },
];

export const PERFIL_LABEL = {
  admin: 'Admin',
  gestor: 'Gestor',
  coordenador: 'Coordenador',
  usuario: 'Usuário',
};

export const precisaSuperior = (perfil) => perfil !== 'gestor';

export function candidatosASuperior(perfil, colaboradores, excluirId = null) {
  if (perfil === 'gestor') return [];
  const aceitos = perfil === 'coordenador' ? ['gestor'] : ['gestor', 'coordenador'];
  return (colaboradores || [])
    .filter((c) => aceitos.includes(c.perfil) && c.id !== excluirId)
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
}
