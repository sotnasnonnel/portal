// O que a pessoa comemora HOJE: aniversário e/ou ano de casa (pedido da Ana
// Claudia, RH, 06/10/2026 — destaque no topo da Home só para ela). Mesma regra
// da lista do mês (RPC aniversariantes_mes): tempo de casa só a partir de 1 ano.

// "yyyy-mm-dd" -> [ano, mês, dia]. Lido como texto: new Date("yyyy-mm-dd") é
// meia-noite UTC e, no fuso do Brasil, cairia no dia anterior.
function partes(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

const bissexto = (ano) => (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;

// Mesmo dia e mês. Quem faz em 29/02 comemora em 28/02 nos anos não bissextos.
function caiHoje([, mes, dia], hoje) {
  const hm = hoje.getMonth() + 1;
  const hd = hoje.getDate();
  if (mes === 2 && dia === 29 && !bissexto(hoje.getFullYear())) return hm === 2 && hd === 28;
  return mes === hm && dia === hd;
}

export function comemoracoesDoDia({ dataNascimento, dataAdmissao } = {}, hoje = new Date()) {
  const lista = [];
  const nasc = partes(dataNascimento);
  if (nasc && caiHoje(nasc, hoje)) lista.push({ tipo: 'aniversario' });
  const adm = partes(dataAdmissao);
  if (adm && caiHoje(adm, hoje)) {
    const anos = hoje.getFullYear() - adm[0];
    if (anos >= 1) lista.push({ tipo: 'tempo_casa', anos });
  }
  return lista;
}
