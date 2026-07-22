import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filtrarOpcoes } from './searchFilter.js';

const OPTS = [
  { value: '1', label: 'André Guimarães' },
  { value: '2', label: 'Bruno Azevedo' },
  { value: '3', label: 'Pedro Morais' },
];

test('busca vazia devolve todas as opções', () => {
  assert.deepEqual(filtrarOpcoes(OPTS, ''), OPTS);
  assert.deepEqual(filtrarOpcoes(OPTS, '   '), OPTS);
  assert.deepEqual(filtrarOpcoes(OPTS, null), OPTS);
  assert.deepEqual(filtrarOpcoes(OPTS, undefined), OPTS);
});

test('filtra por substring, sem diferenciar maiúsc/minúsc', () => {
  assert.deepEqual(filtrarOpcoes(OPTS, 'bru').map((o) => o.value), ['2']);
  assert.deepEqual(filtrarOpcoes(OPTS, 'MORAIS').map((o) => o.value), ['3']);
  assert.deepEqual(filtrarOpcoes(OPTS, 'a').map((o) => o.value), ['1', '2', '3']); // todos têm "a"
});

test('ignora espaços nas pontas da busca', () => {
  assert.deepEqual(filtrarOpcoes(OPTS, '  pedro  ').map((o) => o.value), ['3']);
});

test('sem correspondência devolve lista vazia', () => {
  assert.deepEqual(filtrarOpcoes(OPTS, 'xyz'), []);
});

test('não quebra com label ausente', () => {
  const opts = [{ value: '1' }, { value: '2', label: 'Ok' }];
  assert.deepEqual(filtrarOpcoes(opts, 'ok').map((o) => o.value), ['2']);
});
