// Quem entra na Consulta do Organograma (/organograma).
//
// Duas portas, e a segunda existe porque a primeira era cara demais: até aqui
// só entrava quem tinha perfil de DP, então liberar a consulta para alguém do
// Administrativo significava torná-lo RH — e RH leva junto as Requisições DP,
// o painel de Horas Extras e o Fechamento PJ.
//
// A flag `organograma_consulta` (Gerenciar acessos) libera só esta tela. Ela
// nunca rebaixa ninguém: quem já tem perfil de DP entra pelo perfil.
//
// Gate de TELA. Os dados não são do portal: vêm das views portal_organograma_*
// do backoffice_phd, abertas ao papel anon (ver useOrganograma.js).

/** Perfis da Gestão de Pessoas que já entravam na consulta. */
export const PERFIS_COM_ORGANOGRAMA = ['gestor', 'coordenador', 'admin', 'rh'];

export function podeConsultarOrganograma(user) {
  if (!user) return false;
  return PERFIS_COM_ORGANOGRAMA.includes(user.perfil) || user.organogramaConsulta === true;
}

/** Só a flag, sem o perfil: é o que faz aparecer o grupo "Consultas" para quem não é do DP. */
export function soPelaFlagDoOrganograma(user) {
  return !!user && !PERFIS_COM_ORGANOGRAMA.includes(user.perfil) && user.organogramaConsulta === true;
}
