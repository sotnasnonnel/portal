// Papéis da Gestão de Horas — DERIVADOS do perfil da Gestão de Pessoas
// (colaboradores.perfil), com a coluna horas_role como ELEVAÇÃO só-do-Horas
// (torna alguém gestor/coordenador apenas aqui, sem abrir a Gestão de Pessoas —
// ver horasRoleFromPerfil no AuthContext e app_private.my_horas_role no banco):
//   usuario     -> aponta e vê o próprio tempo
//   coordenador -> aponta e vê/administra a sua equipe (a subárvore abaixo dele)
//   gestor      -> aponta e vê/administra a sua equipe; no topo da árvore, a
//                  empresa toda. (perfil admin também entra aqui.)
// A visibilidade real (o próprio + a subárvore via superior_id) é garantida
// pela RLS do banco; aqui os papéis só decidem menus, telas e filtros.
//
// horas_role tem ainda um quarto valor, 'admin' (ver isHorasAdmin no fim): é o
// "vê tudo" do módulo. Não entra em ROLES porque, para menus e telas, ele se
// comporta como 'gestor' — o que muda é o ESCOPO, decidido pela RLS.
// Extensão explícita: este arquivo também roda no node:test (roles.test.js).
import { isSuperAdmin } from '../../../config/superAdmin.js';

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

// "Admin do módulo": enxerga e administra o Horas INTEIRO — todas as pessoas,
// todas as áreas, todos os projetos — em vez de só a própria subárvore. São o
// admin do portal, o super-admin e quem tem horas_role='admin' (a elevação
// só-daqui, que não abre a Gestão de Pessoas). Recebe o `user`, não o papel,
// porque o papel de UI dos três é 'gestor'. Espelha app_private.is_horas_admin().
export const isHorasAdmin = (user) =>
  user?.perfil === 'admin' || user?.horasRole === 'admin' || isSuperAdmin(user);

// Quem configura a Gestão de Horas centralmente — hoje duas telas:
//   /horas/config/apontamento -> os campos de QUALQUER equipe
//   /horas/config/projetos    -> quem enxerga cada projeto no seletor
// É curadoria central, mais restrita que a configuração de projetos por área
// (que cada líder mantém na sua): as duas telas mexem no formato do apontamento
// e na visibilidade da empresa inteira.
// Não é isHorasAdmin de propósito — aquilo inclui todo perfil='admin' (hoje 5
// pessoas, com o usuário de sistema junto).
// Espelha app_private.pode_configurar_horas() no banco, que é quem protege de
// verdade; mudar a lista é mudar nos dois lugares.
export const CONFIG_HORAS_EMAILS = [
  'marcus.guimaraes@phdengenharia.eng.br', // Marcus Guimarães
  'lennon.santos@phdengenharia.eng.br', // Lennon Santos
  'vinicius.costa@phdengenharia.eng.br', // Vinicius Costa
];

export const podeConfigurarHoras = (user) =>
  CONFIG_HORAS_EMAILS.includes((user?.email || '').toLowerCase());

// Todos apontam — o antigo papel supervisor "diretoria" (que não apontava)
// deixou de existir.
export const podeApontar = () => true;

// Escopo do dashboard/registros: usuário vê só o seu; a gestão vê a equipe
// (a subárvore — a RLS já limita o que volta do banco).
export const escopo = (role) => (isGestao(role) ? 'equipe' : 'meu');
