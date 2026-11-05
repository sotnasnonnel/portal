import test from 'node:test';
import assert from 'node:assert/strict';
import { PAPEL_PLR_LABEL, podeEditarPlr, podeVerPlr, rotaInicialPlr, veSetoresPlr, veTodosSetoresPlr } from './plr.js';

const com = (plr) => ({ plr });

test('admin: vê tudo, edita e abre em Metas por setor', () => {
  assert.equal(podeVerPlr(com('admin')), true);
  assert.equal(podeEditarPlr(com('admin')), true);
  assert.equal(veTodosSetoresPlr(com('admin')), true);
  assert.equal(veSetoresPlr(com('admin')), true);
  assert.equal(rotaInicialPlr(com('admin')), '/plr/setores');
});

test('gestor: vê a aba Metas por setor, sem editar nem ver todos', () => {
  assert.equal(podeVerPlr(com('gestor')), true);
  assert.equal(podeEditarPlr(com('gestor')), false);
  assert.equal(veTodosSetoresPlr(com('gestor')), false);
  assert.equal(veSetoresPlr(com('gestor')), true);
  assert.equal(rotaInicialPlr(com('gestor')), '/plr/setores');
});

test('usuário: só a aba Resultado por pessoa', () => {
  assert.equal(podeVerPlr(com('usuario')), true);
  assert.equal(podeEditarPlr(com('usuario')), false);
  assert.equal(veSetoresPlr(com('usuario')), false);
  assert.equal(rotaInicialPlr(com('usuario')), '/plr/resultado');
});

test('sem papel: nem o card aparece', () => {
  assert.equal(podeVerPlr(com(null)), false);
  assert.equal(podeVerPlr(undefined), false);
  assert.equal(veSetoresPlr(com(null)), false);
});

test('os três papéis têm rótulo na sidebar', () => {
  assert.deepEqual(Object.keys(PAPEL_PLR_LABEL).sort(), ['admin', 'gestor', 'usuario']);
});
