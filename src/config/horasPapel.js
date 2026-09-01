// Papel de uma pessoa no Controle de Horas.
//
// O papel BASE deriva da hierarquia da Gestão de Pessoas (perfil): gestor e
// coordenador enxergam a própria equipe, o resto vê só o próprio tempo. A
// coluna `colaboradores.horas_role` é uma ELEVAÇÃO só-deste-módulo — torna
// alguém gestor/coordenador aqui sem promover o perfil e sem abrir a Gestão de
// Pessoas. O papel efetivo é o MAIOR dos dois; a elevação nunca rebaixa.
//
// Espelha app_private.my_horas_role() no banco. `horas_role = 'admin'` (o "vê
// tudo" do módulo) entra como 'gestor': as telas são as mesmas, quem separa o
// escopo é a RLS / isHorasAdmin.
//
// Mora aqui, e não no AuthContext, porque a tela de Gerenciamento de acessos
// precisa mostrar o mesmo papel efetivo que o app aplica — duas contas
// separadas divergiriam na primeira mudança de regra.

/**
 * Perfil EFETIVO na Gestão de Pessoas, que é a entrada do papel do Horas.
 *
 * O RH é uma flag (`rh_dp`) por cima do perfil, não um perfil próprio: quem é
 * RH e não é gestor/coordenador/admin navega como 'rh'. Quem é gestor E RH
 * continua gestor — a flag não rebaixa ninguém.
 */
export function perfilEfetivoDp(perfil, rhDp) {
  return rhDp && !['gestor', 'admin', 'coordenador'].includes(perfil) ? 'rh' : perfil;
}

const HORAS_RANK = { usuario: 1, coordenador: 2, gestor: 3, admin: 3 };

/** Papel efetivo no módulo: o maior entre o derivado do perfil e a elevação. */
export function horasRoleFromPerfil(perfil, horasRole) {
  const doPerfil = perfil === 'admin' || perfil === 'gestor'
    ? 'gestor'
    : perfil === 'coordenador'
      ? 'coordenador'
      : 'usuario';
  const override = horasRole === 'admin'
    ? 'gestor'
    : horasRole === 'gestor' || horasRole === 'coordenador'
      ? horasRole
      : 'usuario';
  return HORAS_RANK[override] > HORAS_RANK[doPerfil] ? override : doPerfil;
}

/** Rótulo do papel efetivo, para exibição. */
export const HORAS_PAPEL_LABEL = {
  usuario: 'Só o próprio tempo',
  coordenador: 'Coordenador',
  gestor: 'Gestor',
};
