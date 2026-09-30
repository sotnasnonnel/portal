import test from 'node:test';
import assert from 'node:assert/strict';
import {
  podeRegistrarAdicional, veAdicionais, validarRegistro, podeDecidirAdicional, podeCancelarAdicional,
  OUTRO_PROJETO,
} from './adicionalAusencia.js';

test('só coordenador e gestor registram', () => {
  assert.equal(podeRegistrarAdicional({ perfil: 'gestor' }), true);
  assert.equal(podeRegistrarAdicional({ perfil: 'coordenador' }), true);
  assert.equal(podeRegistrarAdicional({ perfil: 'usuario' }), false);
  assert.equal(podeRegistrarAdicional({ perfil: 'admin' }), false);
});

test('o RH vê o módulo mesmo sem registrar', () => {
  assert.equal(veAdicionais({ perfil: 'usuario', rhDp: true }), true);
  assert.equal(veAdicionais({ perfil: 'usuario' }), false);
});

test('validação do registro', () => {
  const ok = { colaboradorId: 'c', projetoId: 'p', dias: '2' };
  assert.equal(validarRegistro(ok), '');
  assert.equal(validarRegistro({ ...ok, colaboradorId: '' }), 'Escolha o colaborador.');
  assert.equal(validarRegistro({ ...ok, projetoId: OUTRO_PROJETO, projetoNome: ' ' }), 'Digite o nome do projeto.');
  assert.equal(validarRegistro({ ...ok, projetoId: OUTRO_PROJETO, projetoNome: 'Obra nova' }), '');
  assert.match(validarRegistro({ ...ok, dias: '0' }), /1 ou mais/);
  assert.match(validarRegistro({ ...ok, dias: '1.5' }), /1 ou mais/);
});

test('decide o aprovador ou o RH, nunca quem registrou nem o beneficiado', () => {
  const r = { status: 'pendente', aprovador_id: 'chefe', registrado_por: 'gestor', colaborador_id: 'c' };
  assert.equal(podeDecidirAdicional(r, { userId: 'chefe' }), true);
  assert.equal(podeDecidirAdicional(r, { userId: 'outro', ehRh: true }), true);
  assert.equal(podeDecidirAdicional(r, { userId: 'gestor', ehRh: true }), false);
  assert.equal(podeDecidirAdicional(r, { userId: 'c', ehRh: true }), false);
  assert.equal(podeDecidirAdicional({ ...r, status: 'aprovada' }, { userId: 'chefe' }), false);
});

test('quem registrou cancela o pendente; aprovado só o RH', () => {
  const r = { status: 'pendente', registrado_por: 'gestor' };
  assert.equal(podeCancelarAdicional(r, { userId: 'gestor' }), true);
  assert.equal(podeCancelarAdicional({ ...r, status: 'aprovada' }, { userId: 'gestor' }), false);
  assert.equal(podeCancelarAdicional({ ...r, status: 'aprovada' }, { userId: 'x', ehRh: true }), true);
  assert.equal(podeCancelarAdicional({ ...r, status: 'reprovada' }, { userId: 'x', ehRh: true }), false);
});
