/**
 * Quanto tempo a mobilização levou (ou está levando).
 *
 * Pedido da Edijane em 28/09/2026 — o número que falta para acompanhar prazo na
 * lista, no processo e na Torre — e base dos cartões de tempo médio que o André
 * pediu nos indicadores.
 *
 * A CONTA: da data-base (o começo do processo) até o fim REAL, que é a última
 * data preenchida nas etapas (`concluido_real`). Processo em andamento conta
 * contra hoje, porque é isso que se quer olhar: quantos dias já se foram.
 *
 * NÃO use `concluido_em` para isso. Ela guarda quando o portal MARCOU o
 * processo como concluído, e nos 107 processos importados isso é o dia da
 * carga — pela régua errada a média dava 114 dias onde o real são 17.
 *
 * DIAS ÚTEIS, contando o dia de abertura e o dia final. Era em dias corridos
 * até 29/09/2026, quando a Edijane apontou a divergência: o #140, aberto na
 * sexta 25/09, aparecia com 4 dias na terça 29/09, e o time conta 3 (sexta,
 * segunda e terça). É a mesma régua dos prazos das etapas.
 *
 * Lógica pura, testável com `node --test`.
 */

import { diasUteisEntre, hojeIso } from '../../../utils/diasUteis.js';

/**
 * Dias de duração do processo, ou null quando não dá para saber.
 *
 * null (e não 0) quando falta a data-base: zero dia seria uma informação, e
 * aqui não há informação nenhuma.
 */
export function tempoTotalDias(processo, hoje = new Date()) {
  if (!processo?.data_base) return null;
  const inicio = String(processo.data_base).slice(0, 10);
  const fim = processo.concluido_real ? String(processo.concluido_real).slice(0, 10) : hojeIso(hoje);
  // Processo importado pode ter a última etapa marcada ANTES da data-base
  // (planilha preenchida a mão): a contagem dá 0, não um número negativo.
  return diasUteisEntre(inicio, fim);
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
