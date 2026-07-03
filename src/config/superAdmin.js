// Super-admin do Portal: único usuário que enxerga a tela de gerenciamento de
// acessos (/portal-admin). A proteção real é a RLS do banco (só admin escreve);
// este gate controla a visibilidade da UI.
export const SUPER_ADMIN_EMAIL = "lennon.santos@phdengenharia.eng.br";

export function isSuperAdmin(user) {
  return (user?.email || "").toLowerCase() === SUPER_ADMIN_EMAIL;
}
