import test from 'node:test';
import assert from 'node:assert/strict';
import { podeAjustarValores, soPelaFlagDeValores } from './valores.js';

test('gestor e admin editam pelo perfil, como antes', () => {
  assert.equal(podeAjustarValores({ perfil: 'gestor' }), true);
  assert.equal(podeAjustarValores({ perfil: 'admin' }), true);
});

// Coordenador e RH nunca editaram valores — a flag existe para não precisar
// promover ninguém a gestor só por causa desta tela.
test('coordenador e RH continuam de fora sem a flag', () => {
  assert.equal(podeAjustarValores({ perfil: 'coordenador' }), false);
  assert.equal(podeAjustarValores({ perfil: 'rh' }), false);
});

test('a flag entra sem perfil de DP', () => {
  assert.equal(podeAjustarValores({ perfil: 'usuario', valoresAjuste: true }), true);
  assert.equal(podeAjustarValores({ perfil: null, valoresAjuste: true }), true);
  assert.equal(podeAjustarValores({ perfil: 'usuario' }), false);
  assert.equal(podeAjustarValores(null), false);
});

test('soPelaFlagDeValores só vale para quem não é gestor/admin', () => {
  assert.equal(soPelaFlagDeValores({ perfil: 'usuario', valoresAjuste: true }), true);
  assert.equal(soPelaFlagDeValores({ perfil: 'gestor', valoresAjuste: true }), false);
  assert.equal(soPelaFlagDeValores({ perfil: 'usuario' }), false);
});
