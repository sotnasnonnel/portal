import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGO, SIGLAS, TAREFAS, ETIQUETAS, TAREFAS2, MODELO_PADRAO } from './catalogoTarefas.js';
import { erroDeConfiguracao } from './camposEquipe.js';

test('o catálogo é o da planilha, sem pares repetidos', () => {
  assert.equal(CATALOGO.length, 162);
  const chaves = new Set(CATALOGO.map(([s, t]) => `${s}|${t}`));
  assert.equal(chaves.size, CATALOGO.length);
  assert.deepEqual(SIGLAS, ['PES', 'POP', 'PTA', 'PTO']);
  assert.deepEqual(ETIQUETAS, ['FIN', 'ENG', 'LPS', 'PLA']);
  assert.deepEqual(TAREFAS2, ['CONTROLAR', 'ELABORAR', 'REVISAR']);
});

test('TAREFAS são as tarefas DISTINTAS: a mesma tarefa cabe em mais de uma sigla', () => {
  assert.equal(TAREFAS.length, 155); // 162 pares, 7 tarefas repetidas entre siglas
  assert.equal(TAREFAS.filter((t) => t === 'CURVA FINANCEIRA').length, 1); // está em PTA e POP
  assert.ok(TAREFAS.every((t) => CATALOGO.some(([, x]) => x === t)));
});

test('MODELO_PADRAO é uma configuração válida de equipe, na ordem da planilha', () => {
  assert.deepEqual(
    MODELO_PADRAO.map((c) => c.label),
    ['Sigla', 'Tarefa', 'Etiqueta', 'Tarefa 2']
  );
  assert.deepEqual(
    MODELO_PADRAO.map((c) => c.ordem),
    [0, 1, 2, 3]
  );
  for (const c of MODELO_PADRAO) {
    assert.equal(c.tipo, 'dropdown');
    assert.equal(c.obrigatorio, true);
    assert.equal(erroDeConfiguracao(c, []), '');
  }
  assert.deepEqual(MODELO_PADRAO[1].opcoes, TAREFAS);
});
