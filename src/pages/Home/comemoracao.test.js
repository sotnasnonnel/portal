import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comemoracoesEmCartaz, diasEmCartaz, rotuloCartaz } from './comemoracao.js';

const dia = (a, m, d) => new Date(a, m - 1, d, 9, 0);
const tipos = (r) => r.map((x) => x.tipo);

// Outubro de 2026: 17 é sábado, 18 domingo, 19 segunda, 20 terça.
const SABADO = dia(2026, 10, 17);
const DOMINGO = dia(2026, 10, 18);
const SEGUNDA = dia(2026, 10, 19);
const TERCA = dia(2026, 10, 20);

test('aniversário no dia e mês, sem olhar o ano', () => {
  assert.deepEqual(tipos(comemoracoesEmCartaz({ dataNascimento: '1990-10-20' }, TERCA)), ['aniversario']);
  assert.deepEqual(tipos(comemoracoesEmCartaz({ dataNascimento: '1990-10-21' }, TERCA)), []);
});

test('tempo de casa conta os anos e só vale a partir de 1', () => {
  assert.deepEqual(comemoracoesEmCartaz({ dataAdmissao: '2021-10-20' }, TERCA).map((x) => [x.tipo, x.anos]),
    [['tempo_casa', 5]]);
  assert.deepEqual(tipos(comemoracoesEmCartaz({ dataAdmissao: '2026-10-20' }, TERCA)), []);
});

test('os dois no mesmo dia', () => {
  const r = comemoracoesEmCartaz({ dataNascimento: '1985-10-20', dataAdmissao: '2020-10-20' }, TERCA);
  assert.deepEqual(tipos(r), ['aniversario', 'tempo_casa']);
});

test('29/02 comemora em 28/02 no ano não bissexto', () => {
  // 28/02/2026 é um sábado e 28/02/2028, uma segunda — nos dois casos a janela
  // não muda a resposta.
  assert.equal(comemoracoesEmCartaz({ dataNascimento: '2000-02-29' }, dia(2026, 2, 28)).length, 1);
  assert.equal(comemoracoesEmCartaz({ dataNascimento: '2000-02-29' }, dia(2028, 2, 27)).length, 0);
  assert.equal(comemoracoesEmCartaz({ dataNascimento: '2000-02-29' }, dia(2028, 2, 29)).length, 1);
});

test('sem data ou data inválida não comemora', () => {
  assert.deepEqual(comemoracoesEmCartaz({}, TERCA), []);
  assert.deepEqual(comemoracoesEmCartaz({ dataNascimento: 'x' }, TERCA), []);
});

// ---------------------------------------------------------------------------
// A janela do fim de semana
// ---------------------------------------------------------------------------

test('dia de semana vê só o próprio dia', () => {
  assert.deepEqual(diasEmCartaz(TERCA).map((d) => d.getDate()), [20]);
});

test('a segunda vê o fim de semana inteiro; o domingo, o sábado', () => {
  assert.deepEqual(diasEmCartaz(SEGUNDA).map((d) => d.getDate()), [17, 18, 19]);
  assert.deepEqual(diasEmCartaz(DOMINGO).map((d) => d.getDate()), [17, 18]);
  assert.deepEqual(diasEmCartaz(SABADO).map((d) => d.getDate()), [17]);
});

test('aniversário de domingo segue em cartaz na segunda (o caso do pedido)', () => {
  const paulo = { dataNascimento: '1980-10-18' };
  const r = comemoracoesEmCartaz(paulo, SEGUNDA);
  assert.deepEqual(tipos(r), ['aniversario']);
  assert.equal(r[0].quando, 'no domingo');
});

test('aniversário de sábado segue em cartaz no domingo e na segunda', () => {
  const sabado = { dataNascimento: '1980-10-17' };
  assert.equal(comemoracoesEmCartaz(sabado, DOMINGO)[0].quando, 'no sábado');
  assert.equal(comemoracoesEmCartaz(sabado, SEGUNDA)[0].quando, 'no sábado');
});

test('a janela não puxa dia útil: sexta não aparece na segunda', () => {
  assert.deepEqual(tipos(comemoracoesEmCartaz({ dataNascimento: '1980-10-16' }, SEGUNDA)), []);
});

test('quem faz no próprio dia é sempre "hoje"', () => {
  assert.equal(comemoracoesEmCartaz({ dataNascimento: '1980-10-19' }, SEGUNDA)[0].quando, 'hoje');
  assert.equal(rotuloCartaz(SEGUNDA, SEGUNDA), 'hoje');
  assert.equal(rotuloCartaz(null, SEGUNDA), 'hoje');
});

// ---------------------------------------------------------------------------
// O feriado na janela
// ---------------------------------------------------------------------------

// Novembro de 2026: 31/10 sábado, 01/11 domingo, 02/11 segunda de Finados,
// 03/11 terça — o caso do pedido.
const FINADOS = dia(2026, 11, 2);
const POS_FINADOS = dia(2026, 11, 3);

test('a terça depois do feriado enxerga o feriado e o fim de semana', () => {
  assert.deepEqual(diasEmCartaz(POS_FINADOS).map((d) => d.getDate()), [31, 1, 2, 3]);
});

test('aniversário no feriado segue em cartaz no dia útil seguinte (o caso da Ana)', () => {
  const ana = { dataNascimento: '1990-11-02' };
  assert.equal(comemoracoesEmCartaz(ana, FINADOS)[0].quando, 'hoje');
  const r = comemoracoesEmCartaz(ana, POS_FINADOS);
  assert.deepEqual(tipos(r), ['aniversario']);
  assert.equal(r[0].quando, 'na segunda-feira');
});

test('o feriado também puxa o fim de semana anterior para o dia útil', () => {
  // Sábado 31/10/2026 ainda aparece na terça, porque a segunda não teve ninguém.
  assert.equal(comemoracoesEmCartaz({ dataNascimento: '1980-10-31' }, POS_FINADOS)[0].quando, 'no sábado');
  // E a quarta 04/11 já não mostra nada disso.
  assert.deepEqual(tipos(comemoracoesEmCartaz({ dataNascimento: '1990-11-02' }, dia(2026, 11, 4))), []);
});

test('feriado no meio da semana: a quinta-feira de Corpus Christi vista na sexta', () => {
  // Páscoa de 2026 em 05/04, logo Corpus Christi na quinta 04/06.
  assert.deepEqual(diasEmCartaz(dia(2026, 6, 5)).map((d) => d.getDate()), [4, 5]);
  assert.equal(comemoracoesEmCartaz({ dataNascimento: '1975-06-04' }, dia(2026, 6, 5))[0].quando,
    'na quinta-feira');
});

test('o Carnaval inteiro cabe na janela da quarta de cinzas', () => {
  // Sábado 14, domingo 15, segunda 16 e terça 17/02/2026 — quarta 18 tem expediente.
  assert.deepEqual(diasEmCartaz(dia(2026, 2, 18)).map((d) => d.getDate()), [14, 15, 16, 17, 18]);
  assert.equal(comemoracoesEmCartaz({ dataNascimento: '1988-02-17' }, dia(2026, 2, 18))[0].quando,
    'na terça-feira');
});

test('o ano de casa sai do dia da comemoração, mesmo quando é feriado', () => {
  // Quem entrou num 01/01 completa os anos no feriado, não no dia útil seguinte:
  // 01/01/2027 é sexta, então a segunda 04/01 ainda mostra.
  const r = comemoracoesEmCartaz({ dataAdmissao: '2020-01-01' }, dia(2027, 1, 4));
  assert.deepEqual(r.map((x) => [x.tipo, x.anos, x.quando]), [['tempo_casa', 7, 'na sexta-feira']]);
});

test('a janela cruza o mês e o ano', () => {
  // Segunda 02/11/2026 enxerga o sábado 31/10.
  const r = comemoracoesEmCartaz({ dataNascimento: '1980-10-31' }, dia(2026, 11, 2));
  assert.equal(r[0].quando, 'no sábado');
  // Quem entrou num 31/12 completa os anos naquele dia, não no ano novo:
  // sábado 31/12/2033, visto na segunda 02/01/2034.
  const casa = comemoracoesEmCartaz({ dataAdmissao: '2020-12-31' }, dia(2034, 1, 2));
  assert.deepEqual(casa.map((x) => [x.tipo, x.anos, x.quando]), [['tempo_casa', 13, 'no sábado']]);
});
