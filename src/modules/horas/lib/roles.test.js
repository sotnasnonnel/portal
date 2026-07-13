import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROLES, ROLE_LABEL, isDiretoria, isGerente, isGestor, podeApontar, escopo } from './roles.js';

test('os três papéis e seus rótulos', () => {
  assert.deepEqual(ROLES, ['usuario', 'gerente', 'diretoria']);
  assert.equal(ROLE_LABEL.usuario, 'Usuário');
  assert.equal(ROLE_LABEL.gerente, 'Gerente');
  assert.equal(ROLE_LABEL.diretoria, 'Diretoria');
});

test('classificação por papel', () => {
  assert.equal(isDiretoria('diretoria'), true);
  assert.equal(isDiretoria('gerente'), false);
  assert.equal(isGerente('gerente'), true);
  assert.equal(isGerente('diretoria'), false);
  // isGestor: quem administra alguma gerência
  assert.equal(isGestor('gerente'), true);
  assert.equal(isGestor('diretoria'), true);
  assert.equal(isGestor('usuario'), false);
});

test('só a diretoria não aponta horas', () => {
  assert.equal(podeApontar('usuario'), true);
  assert.equal(podeApontar('gerente'), true);
  assert.equal(podeApontar('diretoria'), false);
});

test('escopo espelha scopedApontamentos do protótipo', () => {
  assert.equal(escopo('usuario'), 'meu');
  assert.equal(escopo('gerente'), 'gerencia');
  assert.equal(escopo('diretoria'), 'geral');
});

test('valor desconhecido cai no papel mais restrito', () => {
  // Um horas_role inesperado não deve destravar gestão nem esconder o Apontar.
  assert.equal(isGestor('qualquer'), false);
  assert.equal(podeApontar('qualquer'), true);
  assert.equal(escopo('qualquer'), 'meu');
});
