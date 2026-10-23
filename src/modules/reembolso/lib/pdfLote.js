/**
 * Baixar vários PDFs de uma vez, pela lista (só admin).
 * Lógica pura, testada em pdfLote.test.js.
 */

/** O pedido tem PDF? O mesmo critério do botão "Gerar PDF" do detalhe. */
export function temPdf(r) {
  return r?.status === "aprovado";
}

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
