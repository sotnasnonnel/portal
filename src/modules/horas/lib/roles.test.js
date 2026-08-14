import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLES,
  ROLE_LABEL,
  isGestor,
  isCoordenador,
  isGestao,
  isHorasAdmin,
  podeApontar,
  escopo,
  CONFIG_APONTAMENTO_EMAILS,
  podeConfigurarApontamento,
} from './roles.js';
import { SUPER_ADMIN_EMAIL } from '../../../config/superAdmin.js';

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

test('admin do módulo: vê todas as equipes sem ser admin do portal', () => {
  // A elevação horas_role='admin' basta, mesmo com perfil de gestor comum.
  assert.equal(isHorasAdmin({ perfil: 'gestor', horasRole: 'admin' }), true);
  // O admin do portal e o super-admin continuam entrando.
  assert.equal(isHorasAdmin({ perfil: 'admin' }), true);
  assert.equal(isHorasAdmin({ perfil: 'usuario', email: SUPER_ADMIN_EMAIL }), true);
  // Gestor/coordenador comum vê só a própria subárvore.
  assert.equal(isHorasAdmin({ perfil: 'gestor', horasRole: 'gestor' }), false);
  assert.equal(isHorasAdmin({ perfil: 'coordenador' }), false);
  assert.equal(isHorasAdmin(null), false);
});

test('configurar campos do apontamento: só a lista nominal, e não é o admin do módulo', () => {
  for (const email of CONFIG_APONTAMENTO_EMAILS) {
    assert.equal(podeConfigurarApontamento({ email }), true);
    assert.equal(podeConfigurarApontamento({ email: email.toUpperCase() }), true);
  }
  // Admin do portal/do módulo NÃO entra por ser admin — a lista é nominal.
  assert.equal(podeConfigurarApontamento({ perfil: 'admin', email: 'washington.maciel@phdengenharia.eng.br' }), false);
  assert.equal(podeConfigurarApontamento({ perfil: 'gestor', horasRole: 'admin', email: 'outro@phdengenharia.eng.br' }), false);
  assert.equal(podeConfigurarApontamento({}), false);
  assert.equal(podeConfigurarApontamento(null), false);
});

test('valor desconhecido cai no papel mais restrito', () => {
  // Um perfil inesperado não deve destravar gestão nem esconder o Apontar.
  assert.equal(isGestao('qualquer'), false);
  assert.equal(podeApontar('qualquer'), true);
  assert.equal(escopo('qualquer'), 'meu');
});
