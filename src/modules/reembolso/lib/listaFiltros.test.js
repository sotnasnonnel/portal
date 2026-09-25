import test from 'node:test';
import assert from 'node:assert/strict';
import { filtrarLista, opcoesDaLista, ordenarLista, proximaOrdem } from './listaFiltros.js';

const rows = [
  { id: 1, client_obra: 'Obra São José', requester_name: 'Daniela Sebrian', request_date: '2026-09-10' },
  { id: 2, client_obra: 'Vale - Itabira', requester_name: 'Ângelo Souza', request_date: '2026-08-30' },
  { id: 3, client_obra: null, requester_name: 'Bruno Lima', request_date: '2026-09-01' },
];
const ids = (l) => l.map((r) => r.id);

test('filtro por obra bate o valor inteiro, sem acento e caixa', () => {
  assert.deepEqual(ids(filtrarLista(rows, { obra: 'obra sao jose' })), [1]);
  assert.deepEqual(ids(filtrarLista(rows, { obra: 'Obra' })), []);
});

test('filtro por solicitante bate o valor inteiro', () => {
  assert.deepEqual(ids(filtrarLista(rows, { solicitante: 'Ângelo Souza' })), [2]);
  assert.deepEqual(ids(filtrarLista(rows, { solicitante: 'Ângelo' })), []);
});

test('opções: distintas, em ordem, sem vazio, uma por grafia', () => {
  const extra = [...rows, { client_obra: ' obra são josé ', requester_name: 'Bruno Lima' }];
  assert.deepEqual(opcoesDaLista(extra), {
    obras: ['Obra São José', 'Vale - Itabira'],
    solicitantes: ['Ângelo Souza', 'Bruno Lima', 'Daniela Sebrian'],
  });
});

test('período inclui as duas pontas', () => {
  assert.deepEqual(ids(filtrarLista(rows, { de: '2026-09-01', ate: '2026-09-10' })), [1, 3]);
});

test('sem filtro, lista inteira', () => {
  assert.deepEqual(ids(filtrarLista(rows, {})), [1, 2, 3]);
});

test('ordena por data e inverte', () => {
  assert.deepEqual(ids(ordenarLista(rows, { coluna: 'data', direcao: 'asc' })), [2, 3, 1]);
  assert.deepEqual(ids(ordenarLista(rows, { coluna: 'data', direcao: 'desc' })), [1, 3, 2]);
});

test('obra vazia vai para o fim nos dois sentidos', () => {
  assert.equal(ordenarLista(rows, { coluna: 'obra', direcao: 'asc' }).at(-1).id, 3);
  assert.equal(ordenarLista(rows, { coluna: 'obra', direcao: 'desc' }).at(-1).id, 3);
});

test('ordem por solicitante trata acento como letra base', () => {
  assert.deepEqual(ids(ordenarLista(rows, { coluna: 'solicitante', direcao: 'asc' })), [2, 3, 1]);
});

test('clique no cabeçalho: asc, desc, sem ordem', () => {
  const a = proximaOrdem(null, 'data');
  assert.deepEqual(a, { coluna: 'data', direcao: 'asc' });
  const b = proximaOrdem(a, 'data');
  assert.deepEqual(b, { coluna: 'data', direcao: 'desc' });
  assert.equal(proximaOrdem(b, 'data'), null);
  assert.deepEqual(proximaOrdem(b, 'obra'), { coluna: 'obra', direcao: 'asc' });
});
