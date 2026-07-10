// Papéis do Controle de Horas (colaboradores.horas_role), como no protótipo.
//   usuario   -> aponta e vê o próprio tempo
//   gerente   -> aponta, e vê/administra a sua gerência
//   diretoria -> vê tudo e administra todas as gerências (não aponta)
export const ROLES = ['usuario', 'gerente', 'diretoria'];

export const ROLE_LABEL = {
  usuario: 'Usuário',
  gerente: 'Gerente',
  diretoria: 'Diretoria',
};

export const isDiretoria = (role) => role === 'diretoria';
export const isGerente = (role) => role === 'gerente';
// Quem administra alguma gerência (configuração, equipe, exclusão de apontamentos alheios).
export const isGestor = (role) => role === 'gerente' || role === 'diretoria';

// A diretoria supervisiona; quem aponta horas é usuário e gerente.
export const podeApontar = (role) => role !== 'diretoria';

// Escopo do dashboard/registros, espelhando scopedApontamentos() do protótipo.
export const escopo = (role) => (isDiretoria(role) ? 'geral' : isGerente(role) ? 'gerencia' : 'meu');
