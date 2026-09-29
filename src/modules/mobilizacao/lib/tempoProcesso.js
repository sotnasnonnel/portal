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
 * DIAS CORRIDOS, e não úteis: o pedido é "tempo total de mobilização", que é
 * quanto a pessoa esperou. Prazo de etapa continua em dias úteis, que é outra
 * pergunta — quanto tempo o time teve para trabalhar.
 *
 * Lógica pura, testável com `node --test`.
 */

const DIA = 86400000;

/** 'AAAA-MM-DD' (ou Date/ISO) → Date local ao meio-dia, longe de borda de fuso. */
function dia(valor) {
  if (!valor) return null;
  const iso = String(valor).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
}

/**
 * Dias de duração do processo, ou null quando não dá para saber.
 *
 * null (e não 0) quando falta a data-base: zero dia seria uma informação, e
 * aqui não há informação nenhuma.
 */
export function tempoTotalDias(processo, hoje = new Date()) {
  const inicio = dia(processo?.data_base);
  if (!inicio) return null;

  const fim = processo?.concluido_real
    ? dia(processo.concluido_real)
    : new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 12, 0, 0);
  if (!fim) return null;

  // Processo importado pode ter a última etapa marcada ANTES da data-base
  // (planilha preenchida a mão). Negativo não é duração: vira zero.
  return Math.max(0, Math.round((fim.getTime() - inicio.getTime()) / DIA));
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
