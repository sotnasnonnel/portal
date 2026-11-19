import test from 'node:test';
import assert from 'node:assert/strict';
import { haVersaoNova } from './versaoApp.js';

test('avisa quando o servidor publicou outra versão', () => {
  assert.equal(haVersaoNova('abc123', { versao: 'def456' }), true);
});

test('não avisa quando a versão é a mesma', () => {
  assert.equal(haVersaoNova('abc123', { versao: 'abc123' }), false);
});

test('não avisa quando a página não sabe a própria versão (rodando local)', () => {
  assert.equal(haVersaoNova('', { versao: 'def456' }), false);
  assert.equal(haVersaoNova(undefined, { versao: 'def456' }), false);
});

test('não avisa quando a resposta do servidor veio estranha', () => {
  assert.equal(haVersaoNova('abc123', null), false);
  assert.equal(haVersaoNova('abc123', {}), false);
  assert.equal(haVersaoNova('abc123', { versao: '' }), false);
  assert.equal(haVersaoNova('abc123', { versao: 42 }), false);
});
