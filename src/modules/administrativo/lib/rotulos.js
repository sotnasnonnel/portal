/**
 * Rótulos de apresentação do chamado.
 *
 * Lógica pura — sem React — para poder ser testada e ficar num lugar só. Antes
 * cada tela montava o seu, e a repetição aparecia numa e não na outra.
 */

/** Compara ignorando caixa, acento e espaço sobrando. */
const mesma = (a, b) => {
  const limpo = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim().toLowerCase();
  return limpo(a) === limpo(b) && limpo(a) !== '';
};

/**
 * Linha de contexto abaixo do título do chamado.
 *
 * O título já mostra o assunto, que na maioria dos serviços É o rótulo do
 * serviço. Em classes de serviço único — Compras, Uber, Correio — o rótulo da
 * classe também é igual, e a tela virava "Solicitação de compra · Solicitação
 * de compra". Aqui sobra só o que acrescenta informação.
 *
 * @returns {string} '' quando não há nada a acrescentar; a tela então omite a linha.
 */
export function contextoDoChamado({ classeLabel, servicoLabel, assunto } = {}) {
  const partes = [];
  for (const p of [classeLabel, servicoLabel]) {
    if (!p) continue;
    if (mesma(p, assunto)) continue;                 // já está no título
    if (partes.some((x) => mesma(x, p))) continue;   // classe igual ao serviço
    partes.push(p);
  }
  return partes.join(' · ');
}
