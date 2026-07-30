import { isSuperAdmin } from '../../../config/superAdmin.js';

// Papéis do Controle de Horas — DERIVADOS do perfil da Gestão de Pessoas
// (colaboradores.perfil), com a coluna horas_role como ELEVAÇÃO só-do-Horas
// (torna alguém gestor/coordenador apenas aqui, sem abrir a Gestão de Pessoas —
// ver horasRoleFromPerfil no AuthContext e app_private.my_horas_role no banco):
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

// DP/Admin das HORAS EXTRAS: trata o destino da hora, cancela, marca compensado,
// libera exceções de prazo e lê a auditoria. Espelha
// app_private.is_horas_extras_dp() no banco — quem protege de verdade é a RLS.
// `rh` é o perfil efetivo de quem tem rh_dp sem ser gestor (ver AuthContext).
export function isHorasExtrasDp(user) {
  if (!user) return false;
  return (
    user.rhDp === true || user.perfil === 'rh' || user.perfil === 'admin' || isSuperAdmin(user)
  );
}

// Escopo do dashboard/registros: usuário vê só o seu; a gestão vê a equipe
// (a subárvore — a RLS já limita o que volta do banco).
export const escopo = (role) => (isGestao(role) ? 'equipe' : 'meu');
