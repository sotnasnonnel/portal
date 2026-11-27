// Busca da Home: acha qualquer tela, chamado ou ferramenta do portal pelo nome.
//
// Este arquivo é só o casamento e a ordem, sem React e sem imports — é o que os
// testes cobrem. O índice (o QUE pode ser achado, já filtrado pelo que a pessoa
// pode abrir) é montado em pages/Home/indiceBusca.js.
//
// Entrada do índice: { titulo, onde, termos?, href? | url?, tipo }.
//   onde   — o caminho até a tela ("Financeiro · Cartões"); entra na busca,
//            então "dashboard reembolso" acha o Dashboard do Reembolso.
//   termos — apelidos que não aparecem na tela ("férias", "pmo", "clara").
//   tipo   — 'modulo' | 'tela' | 'chamado' | 'externo'.

// Tolerante a acento e caixa: "manutencao" acha "Manutenção".
export const normalizar = (s) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Empate de relevância: o módulo vem antes da tela de dentro dele, e o que é do
// portal vem antes do link para fora.
const ORDEM_TIPO = { modulo: 0, tela: 1, chamado: 2, externo: 3 };

export const MAX_RESULTADOS = 8;

/**
 * Filtra e ordena o índice pelo que foi digitado.
 *
 * Palavra a palavra, como no catálogo do Atendimento: "reserva veiculo" acha
 * "Reserva de veículos", que como texto corrido não bateria por causa do "de".
 * Toda palavra precisa aparecer em algum lugar (título, caminho ou apelidos);
 * a ordem é por ONDE apareceu — no começo do título pesa mais que num apelido.
 */
export function buscarNoIndice(indice = [], texto = '', max = MAX_RESULTADOS) {
  const termo = normalizar(texto);
  if (!termo) return [];
  const palavras = termo.split(/\s+/);

  const achados = [];
  indice.forEach((e, pos) => {
    const titulo = normalizar(e.titulo);
    const onde = normalizar(e.onde);
    const alvo = `${titulo} ${onde} ${normalizar(e.termos)}`;
    if (!palavras.every((p) => alvo.includes(p))) return;

    let nota;
    if (titulo === termo) nota = 0;
    else if (titulo.startsWith(termo)) nota = 1;
    else if (palavras.every((p) => titulo.includes(p))) nota = 2;
    else if (palavras.every((p) => `${titulo} ${onde}`.includes(p))) nota = 3;
    else nota = 4;
    achados.push({ e, nota, pos });
  });

  return achados
    .sort((a, b) => a.nota - b.nota
      || (ORDEM_TIPO[a.e.tipo] ?? 9) - (ORDEM_TIPO[b.e.tipo] ?? 9)
      || a.pos - b.pos)
    .slice(0, max)
    .map((a) => a.e);
}

/**
 * Junta repetidos pelo destino. A mesma tela costuma aparecer em dois lugares
 * (o card da Home e o item do menu, com nomes diferentes: "Apontamento" e
 * "Apontar"). Fica a primeira, que é a mais geral, e o nome da outra vira
 * apelido dela — assim os dois nomes continuam achando a tela.
 */
export function semRepetidos(indice = []) {
  const porDestino = new Map();
  const saida = [];
  indice.forEach((e) => {
    const chave = e.href || e.url;
    if (!chave) return;
    const ja = porDestino.get(chave);
    if (ja) {
      ja.termos = [ja.termos, e.titulo, e.onde, e.termos].filter(Boolean).join(' ');
      return;
    }
    const copia = { ...e };
    porDestino.set(chave, copia);
    saida.push(copia);
  });
  return saida;
}
