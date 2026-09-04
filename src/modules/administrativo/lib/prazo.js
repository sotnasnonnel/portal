/**
 * Prazo em dias úteis — mudou de casa.
 *
 * A regra não é do Administrativo, é do portal: a Mobilização conta os prazos
 * das etapas dela do mesmo jeito, e duas cópias divergiriam na primeira vez que
 * alguém tratasse feriado só de um lado.
 *
 * Este arquivo continua existindo como re-export para não mexer nos ~8 pontos
 * que já importam daqui. Código novo deve importar de src/utils/diasUteis.js.
 */
export {
  ehDiaUtil, proximoDiaUtil, venceEmDiasUteis, venceEmISO,
} from '../../../utils/diasUteis.js';
