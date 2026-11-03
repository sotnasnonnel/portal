/**
 * Calendário de FERIADOS — o que faltava no portal.
 *
 * Pedido do usuário (03/11/2026): a Ana fez aniversário na segunda 02/11, que
 * foi Finados. Ninguém abriu o portal no feriado e na terça a comemoração já
 * tinha sumido da Home — o mesmo caso do Paulo Paiva, que caiu num domingo e
 * criou a janela do fim de semana em 19/10/2026. Feriado agora conta igual.
 *
 * Tudo CALCULADO: as datas fixas por lei e as móveis tiradas da Páscoa. Não há
 * tabela para alguém manter ano a ano — nem no banco, nem aqui.
 *
 * Espelho em SQL: `app_private.pascoa`, `app_private.feriado` e
 * `app_private.sem_expediente` (supabase/supabase_migration_parabens_feriado.sql).
 * Mexeu em um, mexa no outro: a Home lê as duas pontas.
 *
 * ONDE ISSO VALE — hoje só na janela dos parabéns (src/pages/Home/comemoracao.js).
 * Os PRAZOS em dias úteis (src/utils/diasUteis.js, Atendimento e Mobilização)
 * continuam sem feriado DE PROPÓSITO: ligar o calendário lá empurra todo
 * vencimento já gravado no banco e mexe nos indicadores de atraso de chamados
 * fechados. É uma decisão de outro dia, não um esquecimento.
 */

// Feriados nacionais de data fixa: [mês, dia, nome, a partir do ano].
// 08/12 é o municipal de Belo Horizonte, onde fica a sede (ver o endereço em
// src/config/privacidade.js). Outra praça com feriado próprio entra aqui.
const FIXOS = [
  [1, 1, 'Confraternização Universal'],
  [4, 21, 'Tiradentes'],
  [5, 1, 'Dia do Trabalho'],
  [9, 7, 'Independência'],
  [10, 12, 'Nossa Senhora Aparecida'],
  [11, 2, 'Finados'],
  [11, 15, 'Proclamação da República'],
  [11, 20, 'Consciência Negra', 2024], // nacional pela Lei 14.759/2023
  [12, 8, 'Nossa Senhora da Conceição (Belo Horizonte)'],
  [12, 25, 'Natal'],
];

// Os móveis, em dias de distância da Páscoa. A segunda de Carnaval e o Corpus
// Christi são ponto facultativo na letra da lei, mas ninguém trabalha — e o que
// esta lista responde é "tinha gente no portal?", não "era feriado oficial?".
const MOVEIS = [
  [-48, 'Carnaval (segunda)'],
  [-47, 'Carnaval'],
  [-2, 'Sexta-feira Santa'],
  [60, 'Corpus Christi'],
];

/**
 * Dias parados que não saem de fórmula nenhuma: emenda, ponto facultativo que a
 * PHD decidiu tirar, feriado novo antes de virar lei aqui. 'AAAA-MM-DD'.
 *
 * Esta lista também tem espelho no SQL (`app_private.feriado`, bloco
 * `dias_parados`): acrescentar só de um lado deixa a Home e o banco discordando
 * sobre quem ainda recebe parabéns.
 */
export const DIAS_PARADOS = [];

/**
 * Domingo de Páscoa do ano, pelo algoritmo gregoriano anônimo (Meeus).
 * @returns {Date} meio-dia local, longe de qualquer borda de fuso.
 */
export function pascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return new Date(ano, Math.floor(n / 31) - 1, (n % 31) + 1, 12);
}

const chave = (d) => `${d.getMonth() + 1}-${d.getDate()}`;

// O calendário de um ano custa uma conta de Páscoa; a Home pergunta por vários
// dias seguidos, então fica em memória.
const porAno = new Map();

/** @returns {Map<string, string>} 'mês-dia' -> nome do feriado. */
export function feriadosDoAno(ano) {
  const pronto = porAno.get(ano);
  if (pronto) return pronto;

  const mapa = new Map();
  FIXOS.forEach(([mes, dia, nome, desde]) => {
    if (!desde || ano >= desde) mapa.set(`${mes}-${dia}`, nome);
  });
  const p = pascoa(ano);
  MOVEIS.forEach(([delta, nome]) => {
    const d = new Date(ano, p.getMonth(), p.getDate() + delta, 12);
    // Carnaval de ano novo é impossível, mas a Páscoa + 60 nunca sai de junho:
    // a chave é só mês-dia, então o ano do Date não importa.
    mapa.set(chave(d), nome);
  });
  DIAS_PARADOS.forEach((iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (m && Number(m[1]) === ano) mapa.set(`${Number(m[2])}-${Number(m[3])}`, 'Dia parado');
  });

  porAno.set(ano, mapa);
  return mapa;
}

/** O nome do feriado do dia, ou null se é dia comum. */
export function nomeDoFeriado(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  return feriadosDoAno(d.getFullYear()).get(chave(d)) || null;
}

export const ehFeriado = (d) => nomeDoFeriado(d) !== null;

/**
 * Dia em que a empresa não abre: fim de semana ou feriado. É a pergunta que a
 * janela dos parabéns faz — "tinha gente no portal nesse dia?".
 */
export function semExpediente(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return false;
  const dow = d.getDay();
  return dow === 0 || dow === 6 || ehFeriado(d);
}
