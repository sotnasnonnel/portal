/**
 * Semáforo de prazo — "vencido / perto / ok / sem-prazo".
 *
 * Vive aqui, e não dentro de um módulo, porque a definição de "está apertado"
 * é do portal: se o quadro do Administrativo pintar de amarelo a 24h do
 * vencimento e o da Mobilização a 48h, os dois indicadores passam a discordar
 * sobre a mesma pergunta — e isso é bug de indicador, não estilo.
 *
 * Sem vencimento não há o que semaforizar. Pintar de verde sugeriria uma folga
 * que não existe: um chamado esperando aprovação nem ligou o relógio.
 *
 * Lógica pura para poder ser testada.
 */

/** Janela em que o prazo já é "aperto", e não mais folga. */
export const HORAS_PERTO = 24;

/**
 * @param {string|Date|null} vencimento  timestamp ISO (Adm) ou data 'AAAA-MM-DD' (Mobilização)
 * @returns {'vencido'|'perto'|'ok'|'sem-prazo'}
 */
export function semaforoPrazo(vencimento, agora = Date.now()) {
  if (!vencimento) return 'sem-prazo';
  const faltam = new Date(vencimento).getTime() - agora;
  if (Number.isNaN(faltam)) return 'sem-prazo';
  if (faltam < 0) return 'vencido';
  if (faltam <= HORAS_PERTO * 3600 * 1000) return 'perto';
  return 'ok';
}

/**
 * Semáforo de uma data pura ('AAAA-MM-DD'), que é como a Mobilização guarda
 * prazo. Comparar por milissegundo aqui daria errado: `new Date('2026-08-14')`
 * é UTC e, no nosso fuso, um prazo que vence HOJE apareceria como vencido
 * desde as 21h de ontem. A conta é feita em dias inteiros.
 *
 * @param {number} dias  dias de atraso já calculados pelo banco (dias_atraso),
 *                       ou a diferença entre hoje e a data prevista.
 */
export function semaforoDias(dias) {
  if (dias === null || dias === undefined || Number.isNaN(Number(dias))) return 'sem-prazo';
  const n = Number(dias);
  if (n > 0) return 'vencido';
  // Vence hoje ou amanhã: mesma janela de 24h do semáforo por timestamp.
  if (n >= -1) return 'perto';
  return 'ok';
}
