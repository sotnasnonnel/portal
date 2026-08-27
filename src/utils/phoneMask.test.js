import test from 'node:test';
import assert from 'node:assert/strict';
import { mascaraTelefone, telefoneValido } from './phoneMask.js';

test('monta a máscara conforme os dígitos chegam', () => {
  assert.equal(mascaraTelefone(''), '');
  assert.equal(mascaraTelefone('3'), '(3');
  assert.equal(mascaraTelefone('31'), '(31');
  assert.equal(mascaraTelefone('3199'), '(31) 99');
  assert.equal(mascaraTelefone('319999'), '(31) 9999');
  assert.equal(mascaraTelefone('3199999'), '(31) 9999-9');
});

test('celular separa o nono dígito', () => {
  assert.equal(mascaraTelefone('31999990000'), '(31) 9 9999-0000');
});

test('fixo sai no formato de 8 dígitos', () => {
  assert.equal(mascaraTelefone('3133330000'), '(31) 3333-0000');
});

test('ignora o que não é dígito e corta o excesso', () => {
  assert.equal(mascaraTelefone('(31) 9 9999-0000'), '(31) 9 9999-0000');
  assert.equal(mascaraTelefone('+55 31 99999 0000 123'), '(55) 3 1999-9900');
});

test('válido só com 10 ou 11 dígitos', () => {
  assert.ok(telefoneValido('(31) 9 9999-0000'));
  assert.ok(telefoneValido('(31) 3333-0000'));
  assert.ok(!telefoneValido('(31) 9999-9'));
  assert.ok(!telefoneValido(''));
});
