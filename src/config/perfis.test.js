import test from 'node:test';
import assert from 'node:assert/strict';
import { PERFIL_OPCOES, PERFIL_LABEL, precisaSuperior, candidatosASuperior } from './perfis.js';

const pessoas = [
  { id: 'g1', nome: 'Bruno Gestor', perfil: 'gestor' },
  { id: 'g2', nome: 'Ana Gestora', perfil: 'gestor' },
  { id: 'c1', nome: 'Carla Coordenadora', perfil: 'coordenador' },
  { id: 'u1', nome: 'Duda Usuária', perfil: 'usuario' },
  { id: 'a1', nome: 'Adm', perfil: 'admin' },
];

test('PERFIL_OPCOES tem usuario, coordenador e gestor', () => {
  assert.deepEqual(PERFIL_OPCOES.map((o) => o.value), ['usuario', 'coordenador', 'gestor']);
});

test('PERFIL_LABEL cobre os quatro perfis', () => {
  assert.equal(PERFIL_LABEL.coordenador, 'Coordenador');
  assert.equal(PERFIL_LABEL.gestor, 'Gestor');
  assert.equal(PERFIL_LABEL.usuario, 'Usuário');
  assert.equal(PERFIL_LABEL.admin, 'Admin');
});

test('precisaSuperior: só gestor dispensa superior', () => {
  assert.equal(precisaSuperior('gestor'), false);
  assert.equal(precisaSuperior('coordenador'), true);
  assert.equal(precisaSuperior('usuario'), true);
});

test('candidatosASuperior de coordenador: só gestores, ordenados', () => {
  assert.deepEqual(candidatosASuperior('coordenador', pessoas).map((c) => c.id), ['g2', 'g1']);
});

test('candidatosASuperior de usuario: gestores e coordenadores', () => {
  assert.deepEqual(candidatosASuperior('usuario', pessoas).map((c) => c.id), ['g2', 'g1', 'c1']);
});

test('candidatosASuperior exclui o próprio colaborador', () => {
  assert.deepEqual(candidatosASuperior('usuario', pessoas, 'g1').map((c) => c.id), ['g2', 'c1']);
});

test('candidatosASuperior de gestor: outros gestores (a liderança é toda gestor)', () => {
  assert.deepEqual(candidatosASuperior('gestor', pessoas).map((c) => c.id), ['g2', 'g1']);
});

test('candidatosASuperior de gestor exclui o próprio', () => {
  assert.deepEqual(candidatosASuperior('gestor', pessoas, 'g1').map((c) => c.id), ['g2']);
});

test('candidatosASuperior impede ciclo: não lista descendentes do editado', () => {
  // Cadeia: g1 (topo) <- c1 <- u1. Ao editar g1, nem c1 nem u1 podem ser o superior dele.
  const arvore = [
    { id: 'g1', nome: 'Gestor Um', perfil: 'gestor', superior_id: null },
    { id: 'g2', nome: 'Gestor Dois', perfil: 'gestor', superior_id: null },
    { id: 'c1', nome: 'Coord', perfil: 'gestor', superior_id: 'g1' },
    { id: 'u1', nome: 'Sub', perfil: 'gestor', superior_id: 'c1' },
  ];
  assert.deepEqual(candidatosASuperior('gestor', arvore, 'g1').map((c) => c.id), ['g2']);
});

test('candidatosASuperior tolera lista nula', () => {
  assert.deepEqual(candidatosASuperior('usuario', null), []);
});
