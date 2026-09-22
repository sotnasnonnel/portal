import test from 'node:test';
import assert from 'node:assert/strict';
import { naFolhaDaCompetencia } from './folhaUtil.js';

const SET = '2026-09-01'; // competência de setembro

test('ativo fica na folha', () => {
  assert.equal(naFolhaDaCompetencia({ situacao: 'ativo', data_fim: null }, SET), true);
});

test('encerramento programado para depois continua na folha', () => {
  // O módulo só vira "desligado" na data; até lá a pessoa trabalha e recebe.
  assert.equal(naFolhaDaCompetencia({ situacao: 'ativo', data_fim: '2026-11-30' }, SET), true);
});

test('desligado no meio da competência continua, pelo proporcional', () => {
  assert.equal(naFolhaDaCompetencia({ situacao: 'desligado', data_fim: '2026-09-12' }, SET), true);
  // O primeiro dia do mês também conta.
  assert.equal(naFolhaDaCompetencia({ situacao: 'desligado', data_fim: SET }, SET), true);
});

test('desligado antes do mês começar sai da folha', () => {
  assert.equal(naFolhaDaCompetencia({ situacao: 'desligado', data_fim: '2026-08-31' }, SET), false);
  assert.equal(naFolhaDaCompetencia({ situacao: 'desligado', data_fim: '2025-01-10' }, SET), false);
});

test('desligado sem data de término sai da folha', () => {
  // É o caso dos 13 prestadores que vieram da carga histórica: situação
  // desligado e data_fim nula. São justamente os que não devem mais aparecer.
  assert.equal(naFolhaDaCompetencia({ situacao: 'desligado', data_fim: null }, SET), false);
});

test('envelope sem cadastro atual fica: sem o prestador não há como julgar', () => {
  assert.equal(naFolhaDaCompetencia(null, SET), true);
});
