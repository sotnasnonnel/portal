import test from 'node:test';
import assert from 'node:assert/strict';
import { ordenarLinhas, proximaOrdem } from './ordenacao.js';

const colunas = {
  nome: (l) => l.nome,
  atraso: (l) => l.atraso,
  numero: (l) => l.numero,
};
const ids = (lista) => lista.map((l) => l.id);

test('sem ordem escolhida, devolve a lista como veio', () => {
  const lista = [{ id: 'b' }, { id: 'a' }];
  assert.equal(ordenarLinhas(lista, null, colunas), lista);
  assert.equal(ordenarLinhas(lista, { coluna: 'inexistente', direcao: 'asc' }, colunas), lista);
});

test('texto ignora caixa e acento', () => {
  const lista = [{ id: 1, nome: 'élder' }, { id: 2, nome: 'Ana' }, { id: 3, nome: 'bruno' }];
  assert.deepEqual(ids(ordenarLinhas(lista, { coluna: 'nome', direcao: 'asc' }, colunas)), [2, 3, 1]);
  assert.deepEqual(ids(ordenarLinhas(lista, { coluna: 'nome', direcao: 'desc' }, colunas)), [1, 3, 2]);
});

test('número compara como número, inclusive negativo', () => {
  const lista = [{ id: 1, atraso: 10 }, { id: 2, atraso: -3 }, { id: 3, atraso: 2 }];
  assert.deepEqual(ids(ordenarLinhas(lista, { coluna: 'atraso', direcao: 'asc' }, colunas)), [2, 3, 1]);
});

test('o # do processo ordena pelos dígitos, com os prefixados depois', () => {
  const lista = [
    { id: 1, numero: '367' }, { id: 2, numero: 'P-61' }, { id: 3, numero: '61' }, { id: 4, numero: 'E-145' },
  ];
  assert.deepEqual(ids(ordenarLinhas(lista, { coluna: 'numero', direcao: 'asc' }, colunas)), [3, 1, 4, 2]);
});

test('vazio vai para o fim nas duas direções', () => {
  const lista = [{ id: 1, atraso: null }, { id: 2, atraso: 5 }, { id: 3, atraso: '' }, { id: 4, atraso: 1 }];
  assert.deepEqual(ids(ordenarLinhas(lista, { coluna: 'atraso', direcao: 'asc' }, colunas)), [4, 2, 1, 3]);
  assert.deepEqual(ids(ordenarLinhas(lista, { coluna: 'atraso', direcao: 'desc' }, colunas)), [2, 4, 1, 3]);
});

test('não altera a lista original', () => {
  const lista = [{ id: 2, nome: 'b' }, { id: 1, nome: 'a' }];
  ordenarLinhas(lista, { coluna: 'nome', direcao: 'asc' }, colunas);
  assert.deepEqual(ids(lista), [2, 1]);
});

test('clique no cabeçalho: crescente, decrescente, original', () => {
  const a = proximaOrdem(null, 'nome');
  assert.deepEqual(a, { coluna: 'nome', direcao: 'asc' });
  const b = proximaOrdem(a, 'nome');
  assert.deepEqual(b, { coluna: 'nome', direcao: 'desc' });
  assert.equal(proximaOrdem(b, 'nome'), null);
  assert.deepEqual(proximaOrdem(b, 'atraso'), { coluna: 'atraso', direcao: 'asc' });
});
