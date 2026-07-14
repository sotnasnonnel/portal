// Papéis do Controle de Horas — DERIVADOS do perfil da Gestão de Pessoas
// (colaboradores.perfil). Não há mais horas_role/gerência próprios:
//   usuario     -> aponta e vê o próprio tempo
//   coordenador -> aponta e vê/administra a sua equipe (a subárvore abaixo dele)
//   gestor      -> aponta e vê/administra a sua equipe; no topo da árvore, a
//                  empresa toda. (perfil admin também entra aqui.)
// A visibilidade real (o próprio + a subárvore via superior_id) é garantida
// pela RLS do banco; aqui os papéis só decidem menus, telas e filtros.
export const ROLES = ['usuario', 'coordenador', 'gestor'];

export const ROLE_LABEL = {
  usuario: 'Usuário',
  coordenador: 'Coordenador',
  gestor: 'Gestor',
};

export const isGestor = (role) => role === 'gestor';
export const isCoordenador = (role) => role === 'coordenador';
// Quem enxerga/administra a equipe (subárvore): gestor e coordenador.
export const isGestao = (role) => role === 'gestor' || role === 'coordenador';

// Todos apontam — o antigo papel supervisor "diretoria" (que não apontava)
// deixou de existir.
export const podeApontar = () => true;

// Escopo do dashboard/registros: usuário vê só o seu; a gestão vê a equipe
// (a subárvore — a RLS já limita o que volta do banco).
export const escopo = (role) => (isGestao(role) ? 'equipe' : 'meu');
