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

test('a janela cruza o mês e o ano', () => {
  // Segunda 02/11/2026 enxerga o sábado 31/10.
  const r = comemoracoesEmCartaz({ dataNascimento: '1980-10-31' }, dia(2026, 11, 2));
  assert.equal(r[0].quando, 'no sábado');
  // Quem entrou num 31/12 completa os anos naquele dia, não no ano novo:
  // sábado 31/12/2033, visto na segunda 02/01/2034.
  const casa = comemoracoesEmCartaz({ dataAdmissao: '2020-12-31' }, dia(2034, 1, 2));
  assert.deepEqual(casa.map((x) => [x.tipo, x.anos, x.quando]), [['tempo_casa', 13, 'no sábado']]);
});
