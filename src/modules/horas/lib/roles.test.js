import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROLES, ROLE_LABEL, isGestor, isCoordenador, isGestao, podeApontar, escopo } from './roles.js';

test('os três papéis e seus rótulos', () => {
  assert.deepEqual(ROLES, ['usuario', 'coordenador', 'gestor']);
  assert.equal(ROLE_LABEL.usuario, 'Usuário');
  assert.equal(ROLE_LABEL.coordenador, 'Coordenador');
  assert.equal(ROLE_LABEL.gestor, 'Gestor');
});

test('classificação por papel', () => {
  assert.equal(isGestor('gestor'), true);
  assert.equal(isGestor('coordenador'), false);
  assert.equal(isCoordenador('coordenador'), true);
  assert.equal(isCoordenador('gestor'), false);
  // isGestao: quem administra/enxerga a equipe (gestor e coordenador)
  assert.equal(isGestao('gestor'), true);
  assert.equal(isGestao('coordenador'), true);
  assert.equal(isGestao('usuario'), false);
});

test('todos apontam horas', () => {
  assert.equal(podeApontar('usuario'), true);
  assert.equal(podeApontar('coordenador'), true);
  assert.equal(podeApontar('gestor'), true);
});

test('escopo: usuário vê o seu, a gestão vê a equipe', () => {
  assert.equal(escopo('usuario'), 'meu');
  assert.equal(escopo('coordenador'), 'equipe');
  assert.equal(escopo('gestor'), 'equipe');
});

test('valor desconhecido cai no papel mais restrito', () => {
  // Um perfil inesperado não deve destravar gestão nem esconder o Apontar.
  assert.equal(isGestao('qualquer'), false);
  assert.equal(podeApontar('qualquer'), true);
  assert.equal(escopo('qualquer'), 'meu');
});
