/**
 * Prazo de atendimento em DIAS ÚTEIS.
 *
 * Contar em horas corridas fazia um chamado aberto na sexta à tarde vencer no
 * domingo, sem ninguém ter trabalhado — o indicador acusava atraso que não
 * existiu. Aqui sábado e domingo não contam.
 *
 * NÃO trata feriados: o portal não tem calendário de feriados. Um prazo que
 * cruze feriado fica mais curto do que deveria — é uma limitação conhecida, não
 * um esquecimento. Quando existir a tabela, é só filtrar aqui.
 *
 * Lógica pura para poder ser testada.
 */

const FIM_DE_SEMANA = new Set([0, 6]); // domingo e sábado

export const ehDiaUtil = (d) => !FIM_DE_SEMANA.has(d.getDay());

/** Próximo dia útil, mantendo a hora. Devolve a própria data se já for útil. */
export function proximoDiaUtil(data) {
  const d = new Date(data);
  while (!ehDiaUtil(d)) d.setDate(d.getDate() + 1);
  return d;
}

/**
 * Vencimento a partir de `inicio`, somando `dias` dias úteis e preservando a
 * hora. Começar num fim de semana empurra para a segunda antes de contar —
 * senão o primeiro dia útil seria consumido por um dia em que ninguém trabalha.
 *
 * @returns {Date|null} null quando não há prazo definido.
 */
export function venceEmDiasUteis(inicio, dias) {
  const n = Number(dias);
  if (!Number.isFinite(n) || n <= 0) return null;

  const d = proximoDiaUtil(new Date(inicio));
  for (let i = 0; i < n; i += 1) {
    d.setDate(d.getDate() + 1);
    while (!ehDiaUtil(d)) d.setDate(d.getDate() + 1);
  }
  return d;
}

/** Conveniência para gravar no banco. */
export const venceEmISO = (inicio, dias) => {
  const d = venceEmDiasUteis(inicio, dias);
  return d ? d.toISOString() : null;
};
