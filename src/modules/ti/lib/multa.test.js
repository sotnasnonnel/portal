import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mesesRestantes, multaDevolucao, somarMeses, vencimentoEfetivo,
} from './multa.js';

test('meses restantes: exemplo da regra (31/12/2026 até 28/06/2028 = 18)', () => {
  assert.equal(mesesRestantes('2028-06-28', '2026-12-31'), 18);
});

test('meses restantes: soma 1 quando o dia do vencimento passa o da devolução', () => {
  assert.equal(mesesRestantes('2028-04-16', '2026-10-15'), 19);
  assert.equal(mesesRestantes('2028-04-16', '2026-10-16'), 18);
});

test('meses restantes: nunca negativo', () => {
  assert.equal(mesesRestantes('2028-04-01', '2028-09-10'), 0);
});

test('somarMeses: 24 meses e fim de mês', () => {
  assert.equal(somarMeses('2026-04-01', 24), '2028-04-01');
  assert.equal(somarMeses('2026-01-31', 1), '2026-02-28');
});

test('multa do exemplo: 209,80 × 3 ÷ 24 × 18 = 472,05', () => {
  const m = multaDevolucao({ valor_mensal: '209.80', vencimento_contrato: '2028-06-28' }, '2026-12-31');
  assert.equal(m.meses, 18);
  assert.equal(m.valor, 472.05);
  assert.equal(m.estimado, true);
});

test('multa bate com a tabela da Selbet (19 meses restantes)', () => {
  // Devolução que dá 19 meses para os dois prazos da tabela (01/04 e 16/04).
  const dev = '2026-09-30';
  const casos = [
    ['2026-04-01', 566.72, 1345.96], ['2026-04-16', 209.80, 498.28], ['2026-04-01', 226.37, 537.63],
    ['2026-04-01', 250.00, 593.75], ['2026-04-01', 476.07, 1130.67], ['2026-04-01', 420.04, 997.60],
    ['2026-04-01', 50.00, 118.75], ['2026-04-01', 53.52, 127.11], ['2026-04-01', 201.57, 478.73],
  ];
  for (const [inicio, mensal, esperado] of casos) {
    const m = multaDevolucao({ inicio_contrato: inicio, valor_mensal: mensal, data_devolucao: dev });
    assert.equal(m.meses, 19, `${inicio} ${mensal}`);
    assert.equal(m.valor, esperado, `${inicio} ${mensal}`);
    assert.equal(m.estimado, false);
  }
});

test('início manda no vencimento; sem mensalidade ou data, sem multa', () => {
  assert.equal(vencimentoEfetivo({ inicio_contrato: '2026-04-01', vencimento_contrato: '2028-06-28' }), '2028-04-01');
  assert.equal(multaDevolucao({ vencimento_contrato: '2028-06-28' }, '2026-12-31'), null);
  assert.equal(multaDevolucao({ valor_mensal: 100 }, '2026-12-31'), null);
  assert.equal(multaDevolucao({ valor_mensal: 100, vencimento_contrato: '2028-06-28' }), null);
});
