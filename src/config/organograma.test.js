import test from 'node:test';
import assert from 'node:assert/strict';
import { podeConsultarOrganograma, soPelaFlagDoOrganograma } from './organograma.js';

test('perfis de DP entram sem a flag', () => {
  for (const perfil of ['gestor', 'coordenador', 'admin', 'rh']) {
    assert.equal(podeConsultarOrganograma({ perfil }), true);
  }
});

test('a flag entra sem perfil de DP — inclusive sem perfil nenhum', () => {
  assert.equal(podeConsultarOrganograma({ perfil: 'usuario', organogramaConsulta: true }), true);
  assert.equal(podeConsultarOrganograma({ perfil: null, organogramaConsulta: true }), true);
});

test('sem perfil de DP e sem a flag, não entra', () => {
  assert.equal(podeConsultarOrganograma({ perfil: 'usuario' }), false);
  assert.equal(podeConsultarOrganograma({ perfil: null, organogramaConsulta: false }), false);
  assert.equal(podeConsultarOrganograma(null), false);
});

// O grupo "Consultas" só é acrescentado ao menu de quem não o teria pelo
// perfil; duplicá-lo para um gestor deixaria o item Organograma duas vezes.
test('soPelaFlagDoOrganograma só vale para quem não é do DP', () => {
  assert.equal(soPelaFlagDoOrganograma({ perfil: 'usuario', organogramaConsulta: true }), true);
  assert.equal(soPelaFlagDoOrganograma({ perfil: 'gestor', organogramaConsulta: true }), false);
  assert.equal(soPelaFlagDoOrganograma({ perfil: 'usuario' }), false);
  assert.equal(soPelaFlagDoOrganograma(null), false);
});
