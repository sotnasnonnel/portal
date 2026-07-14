import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lookupProjetos, lookupColaboradores, lookupGerencias } from './lookups.js';

test('lookupProjetos resolve nome/cor e cai em padrão', () => {
  const p = lookupProjetos([{ id: 'p1', nome: 'Alpha', cor: '#123456' }]);
  assert.equal(p.nome('p1'), 'Alpha');
  assert.equal(p.cor('p1'), '#123456');
  assert.equal(p.nome('inexistente'), '—');
  assert.equal(p.cor('inexistente'), '#C44A28'); // cor padrão da marca
});

test('lookupProjetos.usadosEm filtra pelos que aparecem nos apontamentos', () => {
  const p = lookupProjetos([
    { id: 'p1', nome: 'Alpha' },
    { id: 'p2', nome: 'Beta' },
    { id: 'p3', nome: 'Gama' },
  ]);
  const usados = p.usadosEm([{ projetoId: 'p1' }, { projetoId: 'p3' }, { projetoId: 'p1' }]);
  assert.deepEqual(usados.map((x) => x.id), ['p1', 'p3']); // p2 não usado fica de fora
});

test('lookupColaboradores resolve nome/função', () => {
  const c = lookupColaboradores([{ id: 'c1', nome: 'Fulano', funcao: 'Engenheiro' }]);
  assert.equal(c.nome('c1'), 'Fulano');
  assert.equal(c.funcao('c1'), 'Engenheiro');
  assert.equal(c.nome('x'), '—');
  assert.equal(c.funcao('x'), '—');
});

test('lookupColaboradores.usadosEm filtra por colaboradorId', () => {
  const c = lookupColaboradores([
    { id: 'c1', nome: 'A' },
    { id: 'c2', nome: 'B' },
  ]);
  const usados = c.usadosEm([{ colaboradorId: 'c2' }]);
  assert.deepEqual(usados.map((x) => x.id), ['c2']);
});

test('lookupGerencias resolve nome', () => {
  const g = lookupGerencias([{ id: 'g1', nome: 'Engenharia' }]);
  assert.equal(g.nome('g1'), 'Engenharia');
  assert.equal(g.nome('x'), '—');
});
