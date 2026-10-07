import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comemoracoesDoDia } from './comemoracao.js';

const dia = (a, m, d) => new Date(a, m - 1, d, 9, 0);

test('aniversário no dia e mês, sem olhar o ano', () => {
  assert.deepEqual(comemoracoesDoDia({ dataNascimento: '1990-10-07' }, dia(2026, 10, 7)), [{ tipo: 'aniversario' }]);
  assert.deepEqual(comemoracoesDoDia({ dataNascimento: '1990-10-08' }, dia(2026, 10, 7)), []);
});

test('tempo de casa conta os anos e só vale a partir de 1', () => {
  assert.deepEqual(comemoracoesDoDia({ dataAdmissao: '2021-10-07' }, dia(2026, 10, 7)), [{ tipo: 'tempo_casa', anos: 5 }]);
  assert.deepEqual(comemoracoesDoDia({ dataAdmissao: '2026-10-07' }, dia(2026, 10, 7)), []);
});

test('os dois no mesmo dia', () => {
  const r = comemoracoesDoDia({ dataNascimento: '1985-03-15', dataAdmissao: '2020-03-15' }, dia(2026, 3, 15));
  assert.deepEqual(r.map((x) => x.tipo), ['aniversario', 'tempo_casa']);
});

test('29/02 comemora em 28/02 no ano não bissexto', () => {
  assert.equal(comemoracoesDoDia({ dataNascimento: '2000-02-29' }, dia(2026, 2, 28)).length, 1);
  assert.equal(comemoracoesDoDia({ dataNascimento: '2000-02-29' }, dia(2028, 2, 28)).length, 0);
  assert.equal(comemoracoesDoDia({ dataNascimento: '2000-02-29' }, dia(2028, 2, 29)).length, 1);
});

test('sem data ou data inválida não comemora', () => {
  assert.deepEqual(comemoracoesDoDia({}, dia(2026, 10, 7)), []);
  assert.deepEqual(comemoracoesDoDia({ dataNascimento: 'x' }, dia(2026, 10, 7)), []);
});
