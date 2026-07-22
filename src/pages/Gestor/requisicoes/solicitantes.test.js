import { test } from 'node:test';
import assert from 'node:assert/strict';
import { opcoesSolicitantes } from './solicitantes.js';

test('lista distinta de solicitantes, ordenada por nome', () => {
  const participa = [
    { gestor_id: 'b', gestor: { nome: 'Bruno' } },
    { gestor_id: 'a', gestor: { nome: 'André' } },
    { gestor_id: 'b', gestor: { nome: 'Bruno' } }, // repetido -> some
  ];
  assert.deepEqual(opcoesSolicitantes(participa, {}), [
    { value: 'a', label: 'André' },
    { value: 'b', label: 'Bruno' },
  ]);
});

test('prioriza o nome do mapa (RPC) sobre o join', () => {
  const participa = [{ gestor_id: 'a', gestor: { nome: 'Nome do join' } }];
  assert.deepEqual(opcoesSolicitantes(participa, { a: 'Nome do RPC' }), [
    { value: 'a', label: 'Nome do RPC' },
  ]);
});

test('cai para o join e depois para "—" quando não há nome', () => {
  const participa = [
    { gestor_id: 'a', gestor: { nome: 'Do join' } },
    { gestor_id: 'b' }, // sem nome em lugar nenhum
  ];
  const out = opcoesSolicitantes(participa, {});
  assert.deepEqual(out.find((o) => o.value === 'a'), { value: 'a', label: 'Do join' });
  assert.deepEqual(out.find((o) => o.value === 'b'), { value: 'b', label: '—' });
});

test('ignora requisições sem gestor_id', () => {
  const participa = [{ gestor_id: null }, { colaborador_id: 'x' }, { gestor_id: 'a', gestor: { nome: 'A' } }];
  assert.deepEqual(opcoesSolicitantes(participa, {}), [{ value: 'a', label: 'A' }]);
});

test('entradas vazias/ausentes não quebram', () => {
  assert.deepEqual(opcoesSolicitantes([], {}), []);
  assert.deepEqual(opcoesSolicitantes(undefined), []);
});
