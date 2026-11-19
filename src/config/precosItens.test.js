import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comItensExtras, normalizarItem } from './precosItens.js';

test('itens cadastrados entram antes de "Outra", que segue por último', () => {
  assert.deepEqual(
    comItensExtras(['Capacete', 'Jaleco', 'Outra'], ['Luva']),
    ['Capacete', 'Jaleco', 'Luva', 'Outra'],
  );
});

test('lista sem "Outra" só recebe os cadastrados no fim', () => {
  assert.deepEqual(comItensExtras(['Notebook Padrão'], ['Monitor 27']), ['Notebook Padrão', 'Monitor 27']);
});

test('nome repetido (caixa ou espaço diferentes) não duplica a opção', () => {
  assert.deepEqual(
    comItensExtras(['Capacete', 'Outra'], ['capacete ', 'Luva', 'LUVA']),
    ['Capacete', 'Luva', 'Outra'],
  );
});

test('sem cadastrados devolve a lista como está', () => {
  const base = ['A', 'Outra'];
  assert.equal(comItensExtras(base, undefined), base);
  assert.equal(comItensExtras(base, []), base);
});

test('normalizarItem ignora caixa e espaço sobrando', () => {
  assert.equal(normalizarItem('  Botina   com metatarso '), 'botina com metatarso');
});
