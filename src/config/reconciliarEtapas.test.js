import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconciliarEtapas, APROVADORES } from './aprovacao.js';

const ADMIN = APROVADORES.admin;
const nomes = { a: 'Ana', b: 'Bruno', c: 'Carla', d: 'Davi', g: 'Gestor' };
const AGORA = '2026-07-01T00:00:00.000Z';

test('sem nenhuma decisão: cauda = molde inteiro', () => {
  const etapas = [
    { id: 'e1', ordem: 1, aprovador_id: 'a', papel: 'Ana', tipo_etapa: 'aprovacao', status: 'pendente' },
    { id: 'e2', ordem: 2, aprovador_id: ADMIN, papel: 'Admin (execução)', tipo_etapa: 'execucao', status: 'pendente' },
  ];
  const r = reconciliarEtapas(etapas, ['b', 'c'], nomes, 'g', AGORA);
  assert.equal(r.semMudanca, false);
  assert.deepEqual(r.apagarIds, ['e1', 'e2']);
  assert.deepEqual(r.inserir, [
    { ordem: 1, aprovador_id: 'b', papel: 'Bruno', tipo_etapa: 'aprovacao', status: 'pendente', decidido_em: null },
    { ordem: 2, aprovador_id: 'c', papel: 'Carla', tipo_etapa: 'aprovacao', status: 'pendente', decidido_em: null },
    { ordem: 3, aprovador_id: ADMIN, papel: 'Admin (execução)', tipo_etapa: 'execucao', status: 'pendente', decidido_em: null },
  ]);
});

test('uma aprovação feita + molde reordenado: mantém decidida, cauda sem repetir quem decidiu', () => {
  const etapas = [
    { id: 'e1', ordem: 1, aprovador_id: 'a', papel: 'Ana', tipo_etapa: 'aprovacao', status: 'aprovada' },
    { id: 'e2', ordem: 2, aprovador_id: 'b', papel: 'Bruno', tipo_etapa: 'aprovacao', status: 'pendente' },
    { id: 'e3', ordem: 3, aprovador_id: ADMIN, papel: 'Admin (execução)', tipo_etapa: 'execucao', status: 'pendente' },
  ];
  const r = reconciliarEtapas(etapas, ['a', 'c', 'd'], nomes, 'g', AGORA);
  assert.equal(r.semMudanca, false);
  assert.deepEqual(r.apagarIds, ['e2', 'e3']);
  assert.deepEqual(r.inserir, [
    { ordem: 2, aprovador_id: 'c', papel: 'Carla', tipo_etapa: 'aprovacao', status: 'pendente', decidido_em: null },
    { ordem: 3, aprovador_id: 'd', papel: 'Davi', tipo_etapa: 'aprovacao', status: 'pendente', decidido_em: null },
    { ordem: 4, aprovador_id: ADMIN, papel: 'Admin (execução)', tipo_etapa: 'execucao', status: 'pendente', decidido_em: null },
  ]);
});

test('aprovador decidido que sumiu do molde: decisão preservada, não reaparece na cauda', () => {
  const etapas = [
    { id: 'e1', ordem: 1, aprovador_id: 'a', papel: 'Ana', tipo_etapa: 'aprovacao', status: 'aprovada' },
    { id: 'e2', ordem: 2, aprovador_id: 'b', papel: 'Bruno', tipo_etapa: 'aprovacao', status: 'pendente' },
    { id: 'e3', ordem: 3, aprovador_id: ADMIN, papel: 'Admin (execução)', tipo_etapa: 'execucao', status: 'pendente' },
  ];
  const r = reconciliarEtapas(etapas, ['c', 'd'], nomes, 'g', AGORA);
  // e1 (a, aprovada) não está em apagarIds -> preservada
  assert.deepEqual(r.apagarIds, ['e2', 'e3']);
  assert.deepEqual(r.inserir.map((x) => x.aprovador_id), ['c', 'd', ADMIN]);
  assert.deepEqual(r.inserir.map((x) => x.ordem), [2, 3, 4]);
});

test('pronta pra execução + molde adiciona aprovador: novo aprovador antes da execução', () => {
  const etapas = [
    { id: 'e1', ordem: 1, aprovador_id: 'a', papel: 'Ana', tipo_etapa: 'aprovacao', status: 'aprovada' },
    { id: 'e2', ordem: 2, aprovador_id: ADMIN, papel: 'Admin (execução)', tipo_etapa: 'execucao', status: 'pendente' },
  ];
  const r = reconciliarEtapas(etapas, ['a', 'b'], nomes, 'g', AGORA);
  assert.deepEqual(r.apagarIds, ['e2']);
  assert.deepEqual(r.inserir, [
    { ordem: 2, aprovador_id: 'b', papel: 'Bruno', tipo_etapa: 'aprovacao', status: 'pendente', decidido_em: null },
    { ordem: 3, aprovador_id: ADMIN, papel: 'Admin (execução)', tipo_etapa: 'execucao', status: 'pendente', decidido_em: null },
  ]);
});

test('molde inclui o criador na cauda: etapa auto_aprovada', () => {
  const etapas = [
    { id: 'e1', ordem: 1, aprovador_id: ADMIN, papel: 'Admin (execução)', tipo_etapa: 'execucao', status: 'pendente' },
  ];
  const r = reconciliarEtapas(etapas, ['g', 'a'], nomes, 'g', AGORA);
  assert.deepEqual(r.inserir, [
    { ordem: 1, aprovador_id: 'g', papel: 'Gestor', tipo_etapa: 'aprovacao', status: 'auto_aprovada', decidido_em: AGORA },
    { ordem: 2, aprovador_id: 'a', papel: 'Ana', tipo_etapa: 'aprovacao', status: 'pendente', decidido_em: null },
    { ordem: 3, aprovador_id: ADMIN, papel: 'Admin (execução)', tipo_etapa: 'execucao', status: 'pendente', decidido_em: null },
  ]);
});

test('pendentes já iguais à cauda: semMudanca = true', () => {
  const etapas = [
    { id: 'e1', ordem: 1, aprovador_id: 'a', papel: 'Ana', tipo_etapa: 'aprovacao', status: 'pendente' },
    { id: 'e2', ordem: 2, aprovador_id: ADMIN, papel: 'Admin (execução)', tipo_etapa: 'execucao', status: 'pendente' },
  ];
  const r = reconciliarEtapas(etapas, ['a'], nomes, 'g', AGORA);
  assert.equal(r.semMudanca, true);
});

test('nome não resolvido lança erro', () => {
  const etapas = [
    { id: 'e1', ordem: 1, aprovador_id: ADMIN, papel: 'Admin (execução)', tipo_etapa: 'execucao', status: 'pendente' },
  ];
  assert.throws(() => reconciliarEtapas(etapas, ['zzz'], nomes, 'g', AGORA), /sem nome resolvido/i);
});
