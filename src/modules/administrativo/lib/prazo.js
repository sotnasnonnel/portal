/**
 * Prazo em dias úteis — mudou de casa.
 *
 * A regra não é do Atendimento, é do portal: a Mobilização conta os prazos
 * das etapas dela do mesmo jeito, e duas cópias divergiriam na primeira vez que
 * alguém tratasse feriado só de um lado.
 *
 * Este arquivo continua existindo como re-export para não mexer nos ~8 pontos
 * que já importam daqui. Código novo deve importar de src/utils/diasUteis.js.
 */
export {
  ehDiaUtil, proximoDiaUtil, venceEmDiasUteis, venceEmISO,
} from '../../../utils/diasUteis.js';

/**
 * O prazo deste chamado começou DEPOIS do momento em que ele entrou na fila?
 *
 * É o caso do responsável que estava de férias ou de folga na abertura: o
 * gatilho `adm_sla_da_ausencia` empurra o início do SLA para a volta dele
 * (supabase_migration_administrativo_sla_ausencia.sql). A tela usa isto para
 * explicar um vencimento distante — sem explicação, ele parece erro de conta.
 *
 * A margem de um minuto evita que a diferença normal entre o `now()` do banco e
 * o relógio de quem abriu vire "prazo adiado".
 */
export function prazoAdiado({ sla_inicio_em, analise_em, criado_em } = {}) {
  if (!sla_inicio_em) return false;
  const entrouNaFila = analise_em || criado_em;
  if (!entrouNaFila) return false;
  return new Date(sla_inicio_em).getTime() - new Date(entrouNaFila).getTime() > 60000;
}
