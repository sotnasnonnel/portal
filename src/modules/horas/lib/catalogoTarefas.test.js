import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATALOGO,
  SIGLAS,
  ETIQUETAS,
  TAREFAS2,
  CAMPOS,
  SELECAO_VAZIA,
  tarefasDe,
  opcoesDe,
  aplicarSelecao,
  campoBloqueado,
  selecaoValida,
} from './catalogoTarefas.js';

test('o catálogo é o da planilha, sem pares repetidos', () => {
  assert.equal(CATALOGO.length, 162);
  const chaves = new Set(CATALOGO.map(([s, t]) => `${s}|${t}`));
  assert.equal(chaves.size, CATALOGO.length);
  assert.deepEqual(SIGLAS, ['PES', 'POP', 'PTA', 'PTO']);
  assert.deepEqual(ETIQUETAS, ['FIN', 'ENG', 'LPS', 'PLA']);
  assert.deepEqual(TAREFAS2, ['CONTROLAR', 'ELABORAR', 'REVISAR']);
  assert.deepEqual(
    CAMPOS.map((c) => c.chave),
    ['sigla', 'tarefa', 'etiqueta', 'tarefa2']
  );
});

test('a sigla filtra as tarefas', () => {
  const doPto = tarefasDe('PTO');
  assert.deepEqual(doPto, ['SOLICITAÇÃO, CADASTRO DE FORNECEDORES E CONTA BANCARIA NO MAXIMO']);
  assert.ok(tarefasDe('POP').every((t) => CATALOGO.some(([s, x]) => s === 'POP' && x === t)));
  assert.equal(tarefasDe('POP').includes('6WLA'), false); // 6WLA é PTA
  // Sem sigla não há tarefa para oferecer — o campo fica bloqueado.
  assert.deepEqual(tarefasDe(''), []);
});

test('só a Tarefa depende de outro campo', () => {
  assert.deepEqual(
    CAMPOS.filter((c) => c.dependeDe).map((c) => [c.chave, c.dependeDe]),
    [['tarefa', 'sigla']]
  );
  assert.equal(campoBloqueado(SELECAO_VAZIA, 'tarefa'), true);
  assert.equal(campoBloqueado({ ...SELECAO_VAZIA, sigla: 'PTA' }, 'tarefa'), false);
  // Sigla é a porta de entrada; etiqueta e tarefa 2 não dependem de nada.
  for (const chave of ['sigla', 'etiqueta', 'tarefa2']) {
    assert.equal(campoBloqueado(SELECAO_VAZIA, chave), false);
  }
});

test('opcoesDe: a tarefa sai filtrada pela sigla; os outros são listas inteiras', () => {
  const vazia = opcoesDe(SELECAO_VAZIA);
  assert.deepEqual(vazia.sigla, SIGLAS);
  assert.deepEqual(vazia.tarefa, []);

  const comSigla = opcoesDe({ ...SELECAO_VAZIA, sigla: 'PTO' });
  assert.equal(comSigla.tarefa.length, 1);
  // A sigla nunca é filtrada pela tarefa: dá para trocá-la a qualquer momento
  // sem ficar preso na única sigla da tarefa já escolhida.
  assert.deepEqual(opcoesDe({ sigla: 'PTA', tarefa: '6WLA' }).sigla, SIGLAS);

  // Etiqueta e Tarefa 2 são listas fechadas independentes da sigla/tarefa.
  assert.deepEqual(comSigla.etiqueta, ETIQUETAS);
  assert.deepEqual(comSigla.tarefa2, TAREFAS2);
});

test('trocar a sigla limpa a tarefa que não pertence mais a ela', () => {
  const sel = { ...SELECAO_VAZIA, sigla: 'PTA', tarefa: '6WLA' };
  assert.equal(aplicarSelecao(sel, 'sigla', 'POP').tarefa, '');
  // A tarefa que existe nas duas siglas é mantida (o par continua válido).
  const compartilhada = { ...SELECAO_VAZIA, sigla: 'PTA', tarefa: 'CURVA FINANCEIRA' };
  assert.equal(aplicarSelecao(compartilhada, 'sigla', 'POP').tarefa, 'CURVA FINANCEIRA');
});

test('limpar a sigla também limpa a tarefa, que volta a ficar bloqueada', () => {
  const sel = aplicarSelecao({ ...SELECAO_VAZIA, sigla: 'PTA', tarefa: '6WLA' }, 'sigla', '');
  assert.deepEqual(sel, SELECAO_VAZIA);
  assert.equal(campoBloqueado(sel, 'tarefa'), true);
});

test('etiqueta e tarefa 2 não interferem na sigla/tarefa', () => {
  const base = { ...SELECAO_VAZIA, sigla: 'PTA', tarefa: '6WLA' };
  const comEtiqueta = aplicarSelecao(base, 'etiqueta', 'ENG');
  assert.deepEqual(comEtiqueta, { sigla: 'PTA', tarefa: '6WLA', etiqueta: 'ENG', tarefa2: '' });
  const completa = aplicarSelecao(comEtiqueta, 'tarefa2', 'REVISAR');
  assert.equal(completa.sigla, 'PTA');
  assert.equal(completa.tarefa, '6WLA');
});

test('selecaoValida exige os 4 campos e um par sigla/tarefa que exista', () => {
  const ok = { sigla: 'PTA', tarefa: '6WLA', etiqueta: 'ENG', tarefa2: 'REVISAR' };
  assert.equal(selecaoValida(ok), true);
  assert.equal(selecaoValida({ ...ok, tarefa2: '' }), false);
  assert.equal(selecaoValida({ ...ok, etiqueta: 'XXX' }), false);
  // Par que não existe na planilha (6WLA é PTA, não POP).
  assert.equal(selecaoValida({ ...ok, sigla: 'POP' }), false);
  assert.equal(selecaoValida(SELECAO_VAZIA), false);
});
