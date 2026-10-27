/**
 * Quanto tempo a mobilização levou (ou está levando).
 *
 * Pedido da Edijane em 28/09/2026 — o número que falta para acompanhar prazo na
 * lista, no processo e na Torre — e base dos cartões de tempo médio que o André
 * pediu nos indicadores.
 *
 * A CONTA: do dia em que o processo foi ABERTO até o fim REAL, que é a última
 * data preenchida nas etapas (`concluido_real`). Processo em andamento conta
 * contra hoje, porque é isso que se quer olhar: quantos dias já se foram.
 *
 * O COMEÇO é a data mais antiga entre "Aberto em" (`criado_em`) e a data-base.
 * Até 27/10/2026 era só a data-base, que pode ficar DEPOIS da abertura (o
 * #367 foi aberto em 26/10 com data-base em 13/11 e mostrava 0 dia). O "mais
 * antigo" é porque os 124 da planilha, e o 61/75/76, têm `criado_em` no dia da
 * carga (09/09): ali a data-base é o começo de verdade.
 *
 * NÃO use `concluido_em` para isso. Ela guarda quando o portal MARCOU o
 * processo como concluído, e nos 107 processos importados isso é o dia da
 * carga — pela régua errada a média dava 114 dias onde o real são 17.
 *
 * DIAS ÚTEIS, SEM contar o dia da abertura: aberto ontem é 1 dia, aberto hoje
 * é 0. Era em dias corridos até 29/09/2026 e passou a contar as duas pontas a
 * pedido da Edijane (#140, aberto na sexta 25/09, dava 3 na terça 29/09). Em
 * 27/10/2026 a ponta da abertura saiu, porque somava um dia a mais: o mesmo
 * #140 hoje daria 2 (segunda e terça).
 *
 * Lógica pura, testável com `node --test`.
 */

import { deIso, diasUteisEntre, ehDiaUtil, hojeIso, paraIso } from '../../../utils/diasUteis.js';

/** Dia do começo ('AAAA-MM-DD'): o mais antigo entre abertura e data-base. */
export function inicioDoProcesso(processo) {
  // criado_em é instante; o dia é o do fuso de quem olha, como o "Aberto em".
  const aberto = processo?.criado_em ? paraIso(new Date(processo.criado_em)) : null;
  const base = processo?.data_base ? String(processo.data_base).slice(0, 10) : null;
  if (aberto && base) return aberto < base ? aberto : base;
  return aberto || base;
}

/**
 * Dias de duração do processo, ou null quando não dá para saber.
 *
 * null (e não 0) quando não há data de começo: zero dia seria uma informação,
 * e aqui não há informação nenhuma.
 */
export function tempoTotalDias(processo, hoje = new Date()) {
  const inicio = inicioDoProcesso(processo);
  if (!inicio) return null;
  const fim = processo.concluido_real ? String(processo.concluido_real).slice(0, 10) : hojeIso(hoje);
  // Processo importado pode ter a última etapa marcada ANTES do começo
  // (planilha preenchida a mão): a contagem dá 0, não um número negativo.
  const comAbertura = diasUteisEntre(inicio, fim);
  // diasUteisEntre conta as duas pontas; o dia da abertura sai, se tiver contado.
  return comAbertura > 0 && ehDiaUtil(deIso(inicio)) ? comAbertura - 1 : comAbertura;
}

/** O processo já acabou? É o que separa "levou" de "está levando". */
export const estaConcluido = (processo) => !!processo?.concluido_real;

/** Texto curto para a tela: "12 dias", "1 dia", "—". */
export function tempoTotalTexto(processo, hoje = new Date()) {
  const dias = tempoTotalDias(processo, hoje);
  if (dias === null) return '—';
  return `${dias} ${dias === 1 ? 'dia' : 'dias'}`;
}

/**
 * Tempo médio de um conjunto de processos — só os CONCLUÍDOS.
 *
 * Misturar processo em andamento puxaria a média para baixo: quem começou
 * ontem entraria com 1 dia, como se tivesse sido rápido. `total` vai junto para
 * a tela poder dizer de quantos processos a média saiu.
 */
export function tempoMedioDias(processos = [], hoje = new Date()) {
  const dias = processos
    .filter(estaConcluido)
    .map((p) => tempoTotalDias(p, hoje))
    .filter((d) => d !== null);
  if (!dias.length) return { media: null, total: 0 };
  const soma = dias.reduce((a, b) => a + b, 0);
  // Arredonda para CIMA, a pedido do André (29/09/2026): dia começado é dia
  // gasto, e "16,7 dias" não é informação que alguém use — a decisão é sempre
  // sobre dias inteiros.
  return { media: Math.ceil(soma / dias.length), total: dias.length };
}
