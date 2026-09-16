import { isHorasExtrasDp } from './horasExtras';

/**
 * Fechamento PJ — fechamento mensal dos prestadores PJ (Gestão de Pessoas).
 *
 * Quem entra: o DP, pela mesma regra das Horas Extras do DP (rh_dp, admin do
 * DP ou super admin). Enquanto FECHAMENTO_PJ_EM_BREVE for true, só a lista
 * abaixo.
 *
 * ESPELHO NO BANCO: app_private.pode_fechamento_pj() em
 * supabase/supabase_migration_fechamento_pj.sql tem a MESMA regra e a MESMA
 * lista (as tabelas têm CPF e conta bancária). Mudou aqui, mude lá — se as duas
 * divergirem, a tela abre e não lê nada.
 */
export const FECHAMENTO_PJ_EM_BREVE = true;

export const FECHAMENTO_PJ_LIBERADOS = [
  'lennon.santos@phdengenharia.eng.br',
  // Quem opera o fechamento PJ hoje (assinava o protótipo).
  'washington.maciel@phdengenharia.eng.br',
];

export function podeAcessarFechamentoPj(user) {
  if (!isHorasExtrasDp(user)) return false;
  if (!FECHAMENTO_PJ_EM_BREVE) return true;
  return FECHAMENTO_PJ_LIBERADOS.includes((user?.email || '').trim().toLowerCase());
}

export const ROTA_FECHAMENTO_PJ = '/admin/fechamento-pj';
