import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapAlocacoes, distinctMonths, resolveDefaultMonth, deriveFilterOptions,
  applyFilters, formatPercent, formatMonthLabel, countColaboradores,
} from './organogramaData.js';

const CRU = [
  { percentual: null, obra_cod_phd: 'AURI-CT01-GERE', mes: '2026-05-01', colaborador: { nome: 'ADAILTON ANDRADE', gerente: 'Paulo Paiva' } },
  { percentual: 50, obra_cod_phd: 'GOIA-CT01-GERE', mes: '2026-05-01', colaborador: { nome: 'ADAILTON ANDRADE', gerente: 'Paulo Paiva' } },
  { percentual: null, obra_cod_phd: 'CORP>ADM', mes: '2026-01-01', colaborador: { nome: 'ALESSANDRA SOBRAL', gerente: 'Pedro Morais' } },
];

test('mapAlocacoes achata colaborador embutido', () => {
  const out = mapAlocacoes(CRU);
  assert.deepEqual(out[0], { colaborador: 'ADAILTON ANDRADE', contrato: 'AURI-CT01-GERE', gerente: 'Paulo Paiva', percentual: null });
  assert.equal(out[1].percentual, 50);
});

test('mapAlocacoes tolera entrada inválida', () => {
  assert.deepEqual(mapAlocacoes(null), []);
});

test('distinctMonths retorna meses únicos em ordem desc', () => {
  assert.deepEqual(distinctMonths(CRU), ['2026-05-01', '2026-01-01']);
});

test('resolveDefaultMonth usa o mês corrente quando existe', () => {
  const months = ['2026-05-01', '2026-01-01'];
  assert.equal(resolveDefaultMonth(months, new Date('2026-05-15T12:00:00')), '2026-05-01');
});

test('resolveDefaultMonth cai no mais recente quando o corrente não existe', () => {
  const months = ['2026-05-01', '2026-01-01'];
  assert.equal(resolveDefaultMonth(months, new Date('2026-09-10T12:00:00')), '2026-05-01');
});

test('resolveDefaultMonth com lista vazia retorna null', () => {
  assert.equal(resolveDefaultMonth([], new Date('2026-05-15')), null);
});

test('deriveFilterOptions distingue e ordena gerentes e contratos', () => {
  const opts = deriveFilterOptions(mapAlocacoes(CRU));
  assert.deepEqual(opts.gerentes, ['Paulo Paiva', 'Pedro Morais']);
  assert.deepEqual(opts.contratos, ['AURI-CT01-GERE', 'CORP>ADM', 'GOIA-CT01-GERE']);
});

test('applyFilters combina gerente, contrato e nome', () => {
  const rows = mapAlocacoes(CRU);
  assert.equal(applyFilters(rows, { gerente: 'Paulo Paiva' }).length, 2);
  assert.equal(applyFilters(rows, { contrato: 'CORP>ADM' }).length, 1);
  assert.equal(applyFilters(rows, { nome: 'alessandra' }).length, 1);
  assert.equal(applyFilters(rows, {}).length, 3);
});

test('formatPercent mostra — para null e N% para número', () => {
  assert.equal(formatPercent(null), '—');
  assert.equal(formatPercent(undefined), '—');
  assert.equal(formatPercent(''), '—');
  assert.equal(formatPercent(50), '50%');
});

test('formatMonthLabel formata YYYY-MM-01 como MM/AAAA', () => {
  assert.equal(formatMonthLabel('2026-05-01'), '05/2026');
  assert.equal(formatMonthLabel(''), '');
});

test('countColaboradores conta pessoas distintas', () => {
  assert.equal(countColaboradores(mapAlocacoes(CRU)), 2);
});
