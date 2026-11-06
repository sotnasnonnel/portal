/**
 * Baixar vários PDFs de uma vez, pela lista (só admin). Qualquer pedido da
 * lista entra, de qualquer status: o filtro da tela é que escolhe o lote.
 * Lógica pura, testada em pdfLote.test.js.
 */

/**
 * Dois pedidos podem dar o mesmo nome de arquivo (mesma pessoa, mesmas datas,
 * mesmo valor), e no ZIP um apagaria o outro. O repetido ganha " (2)",
 * " (3)"... antes do ".pdf". Sem caixa, porque no Windows "A.pdf" e "a.pdf"
 * são o mesmo arquivo.
 */
export function nomesSemRepetir(nomes) {
  const usados = new Set();
  return nomes.map((nome) => {
    const base = nome.replace(/\.pdf$/i, "");
    let final = nome;
    for (let n = 2; usados.has(final.toLowerCase()); n += 1) final = `${base} (${n}).pdf`;
    usados.add(final.toLowerCase());
    return final;
  });
}
