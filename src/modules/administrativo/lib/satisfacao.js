/**
 * Agregação da pesquisa de satisfação.
 *
 * Lógica pura — sem Supabase, sem React — para poder ser testada. A tela só
 * desenha o que sai daqui.
 */

export const NOTAS_POSSIVEIS = [5, 4, 3, 2, 1];

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
