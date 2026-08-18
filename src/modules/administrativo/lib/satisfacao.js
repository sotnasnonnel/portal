/**
 * Agregação da pesquisa de satisfação.
 *
 * Lógica pura — sem Supabase, sem React — para poder ser testada. A tela só
 * desenha o que sai daqui.
 */

export const NOTAS_POSSIVEIS = [5, 4, 3, 2, 1];

/**
 * O chamado já foi avaliado?
 *
 * Parece bobo, mas não é: `chamado_id` tem UNIQUE em chamados_adm_avaliacoes, e
 * por causa disso o PostgREST entende a relação como um-para-um e devolve o
 * embed como OBJETO, não como lista. Testar `.length` num objeto dá `undefined`
 * — e todo chamado avaliado passava por não avaliado, travando a abertura de
 * novos para quem já tinha avaliado.
 *
 * Aceita as duas formas de propósito: se a UNIQUE cair um dia, o embed volta a
 * ser lista e isto continua certo.
 */
export function temAvaliacao(embed) {
  if (!embed) return false;
  return Array.isArray(embed) ? embed.length > 0 : true;
}

/** Extremos da escala. A pior nota possível é 1 — ninguém tira zero. */
export const NOTA_MIN = 1;
export const NOTA_MAX = 5;

/** Abaixo disso a média é ruído, não sinal: dá para virar com um chamado só. */
export const MINIMO_CONFIAVEL = 3;

/**
 * Faixa da média, usada pela cor do gráfico e da tabela. Uma regra só, num
 * lugar só — cor e número discordarem seria pior que não ter cor.
 */
export function faixaDaMedia(m) {
  if (m === null || m === undefined) return 'vazia';
  if (m < 3) return 'baixa';
  if (m < 4) return 'media';
  return 'alta';
}

/**
 * Onde a média cai no trilho, em %.
 *
 * A escala vai de 1 a 5, não de 0 a 5: como a régua começa em 1, o ponto marca
 * POSIÇÃO, não comprimento. Por isso o gráfico usa ponto e não barra — barra
 * teria de sair do zero para o tamanho não mentir.
 */
export function posicaoNaEscala(m) {
  if (m === null || m === undefined) return 0;
  const preso = Math.min(NOTA_MAX, Math.max(NOTA_MIN, m));
  return ((preso - NOTA_MIN) / (NOTA_MAX - NOTA_MIN)) * 100;
}

/** Média com uma casa, ou null quando não há nota — média de nada não é zero. */
export function media(notas = []) {
  if (!notas.length) return null;
  const soma = notas.reduce((s, n) => s + Number(n), 0);
  return Math.round((soma / notas.length) * 10) / 10;
}

/**
 * Resumo completo do período.
 *
 * @param avaliacoes [{ nota, classe, servico }]
 * @returns {{
 *   total: number, media: number|null,
 *   distribuicao: Array<{nota:number, total:number, pct:number}>,
 *   porServico: Array<{classe:string, servico:string, total:number, media:number}>
 * }}
 */
export function resumoSatisfacao(avaliacoes = []) {
  const notas = avaliacoes.map((a) => Number(a.nota)).filter((n) => Number.isFinite(n));
  const total = notas.length;

  // Todas as cinco notas sempre presentes, mesmo com zero: uma distribuição
  // que esconde o "nenhum 1 estrela" não é uma distribuição.
  const distribuicao = NOTAS_POSSIVEIS.map((nota) => {
    const qtd = notas.filter((n) => n === nota).length;
    return { nota, total: qtd, pct: total ? Math.round((qtd / total) * 100) : 0 };
  });

  const porChave = new Map();
  for (const a of avaliacoes) {
    const n = Number(a.nota);
    if (!Number.isFinite(n)) continue;
    const chave = `${a.classe}/${a.servico}`;
    if (!porChave.has(chave)) porChave.set(chave, { classe: a.classe, servico: a.servico, notas: [] });
    porChave.get(chave).notas.push(n);
  }

  // Pior média primeiro: é onde está o problema a resolver. Empate desempata
  // pelo volume — 2,0 em dez chamados pesa mais que 2,0 em um.
  const porServico = [...porChave.values()]
    .map((g) => ({ classe: g.classe, servico: g.servico, total: g.notas.length, media: media(g.notas) }))
    .sort((a, b) => (a.media - b.media) || (b.total - a.total));

  return { total, media: media(notas), distribuicao, porServico };
}
