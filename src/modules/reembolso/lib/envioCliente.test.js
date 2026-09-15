import test from 'node:test';
import assert from 'node:assert/strict';
import { deveEnviarAoCliente } from './envioCliente.js';

const base = { status: 'aprovado', kind: 'reembolso', billable_to_client: true };

test('reembolso aprovado e cobrado do cliente entra no envio', () => {
  assert.equal(deveEnviarAoCliente(base), true);
});

test('pedido antigo sem kind conta como reembolso', () => {
  assert.equal(deveEnviarAoCliente({ ...base, kind: null }), true);
  assert.equal(deveEnviarAoCliente({ ...base, kind: undefined }), true);
});

test('antes da aprovação não há PDF a mandar', () => {
  assert.equal(deveEnviarAoCliente({ ...base, status: 'em_analise' }), false);
});

test('reprovado e cancelado nunca vão para cobrança', () => {
  assert.equal(deveEnviarAoCliente({ ...base, status: 'reprovado' }), false);
  assert.equal(deveEnviarAoCliente({ ...base, status: 'cancelado' }), false);
});

test('custo da empresa não entra', () => {
  assert.equal(deveEnviarAoCliente({ ...base, billable_to_client: false }), false);
});

test('pedido anterior ao campo (nulo) não entra: "não sei" não é "sim"', () => {
  assert.equal(deveEnviarAoCliente({ ...base, billable_to_client: null }), false);
});

test('adiantamento fica de fora, mesmo reembolsável', () => {
  assert.equal(deveEnviarAoCliente({ ...base, kind: 'adiantamento' }), false);
});

test('sem pedido, sem envio', () => {
  assert.equal(deveEnviarAoCliente(null), false);
});
