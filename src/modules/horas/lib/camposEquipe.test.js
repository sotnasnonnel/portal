import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarCampo,
  limparOpcoes,
  parseOpcoes,
  opcoesTexto,
  paraBanco,
  erroDeConfiguracao,
  paraRascunho,
  deRascunho,
  valoresIniciais,
  faltando,
  preenchimentoValido,
  paraPersistencia,
  lerPersistidos,
  camposDoApontamento,
  labelsUsados,
  valorDoCampo,
} from './camposEquipe.js';

const campo = (over = {}) =>
  normalizarCampo({ id: 'c1', label: 'Sigla', tipo: 'dropdown', opcoes: ['PTA', 'POP'], obrigatorio: true, ...over });

test('normalizarCampo assume os padrões do banco', () => {
  const c = normalizarCampo({ id: 'x', gerencia_id: 'g1', label: 'Frente', ordem: '2' });
  assert.equal(c.gerenciaId, 'g1');
  assert.equal(c.ordem, 2);
  assert.equal(c.tipo, 'dropdown'); // tipo desconhecido/ausente vira lista suspensa
  assert.deepEqual(c.opcoes, []);
  assert.equal(c.obrigatorio, false);
});

test('opções: sem vazios, sem repetidas, na ordem em que foram digitadas', () => {
  assert.deepEqual(limparOpcoes(['  A ', '', 'B', 'A', null]), ['A', 'B']);
  assert.deepEqual(parseOpcoes('Civil\n\n  Montagem  \nCivil\n'), ['Civil', 'Montagem']);
  assert.equal(opcoesTexto(['Civil', 'Montagem']), 'Civil\nMontagem');
});

test('paraBanco: texto livre não carrega opções', () => {
  const b = paraBanco({ label: '  Frente  ', tipo: 'texto', opcoes: ['A'], obrigatorio: true, ordem: 1 }, 'g1');
  assert.deepEqual(b, { gerencia_id: 'g1', label: 'Frente', tipo: 'texto', opcoes: [], obrigatorio: true, ordem: 1 });
});

test('erroDeConfiguracao espelha as travas do banco', () => {
  assert.equal(erroDeConfiguracao(campo()), '');
  assert.match(erroDeConfiguracao(campo({ label: '  ' })), /nome/i);
  // Rótulo repetido na mesma equipe (ignora caixa) — os relatórios agrupam por rótulo.
  const outros = [campo({ id: 'c2', label: 'sigla ' })];
  assert.match(erroDeConfiguracao(campo(), outros), /Já existe/i);
  // Ele mesmo na lista não conta como repetido.
  assert.equal(erroDeConfiguracao(campo(), [campo()]), '');
  assert.match(erroDeConfiguracao(campo({ opcoes: [] })), /pelo menos uma opção/i);
  // Texto livre não precisa de opções.
  assert.equal(erroDeConfiguracao(campo({ tipo: 'texto', opcoes: [] })), '');
});

test('rascunho preserva o texto cru das opções (Enter não some com a linha)', () => {
  const r = paraRascunho(campo({ opcoes: ['PTA', 'POP'] }));
  assert.equal(r.opcoesTxt, 'PTA\nPOP');
  // Enter no fim: a linha em branco fica no texto, mas não vira opção vazia.
  const digitando = { ...r, opcoesTxt: 'PTA\nPOP\n' };
  assert.deepEqual(deRascunho(digitando).opcoes, ['PTA', 'POP']);
});

test('faltando só cobra os obrigatórios', () => {
  const campos = [campo(), campo({ id: 'c2', label: 'Obs', tipo: 'texto', obrigatorio: false })];
  assert.deepEqual(faltando(campos, {}), ['Sigla']);
  assert.deepEqual(faltando(campos, { c1: '   ' }), ['Sigla']); // espaço não preenche
  assert.equal(preenchimentoValido(campos, { c1: 'PTA' }), true);
  // Equipe sem campos configurados não trava o cronômetro.
  assert.equal(preenchimentoValido([], {}), true);
});

test('paraPersistencia grava rótulo em snapshot e ignora campo em branco', () => {
  const campos = [campo(), campo({ id: 'c2', label: 'Obs', tipo: 'texto', obrigatorio: false })];
  assert.deepEqual(paraPersistencia(campos, { c1: ' PTA ', c2: '' }), [
    { id: 'c1', label: 'Sigla', valor: 'PTA' },
  ]);
});

test('valoresIniciais reidrata pelo id (cronômetro em andamento)', () => {
  const campos = [campo(), campo({ id: 'c2', label: 'Obs', tipo: 'texto' })];
  const gravados = [{ id: 'c1', label: 'Sigla', valor: 'PTA' }];
  assert.deepEqual(valoresIniciais(campos, gravados), { c1: 'PTA', c2: '' });
  // Campo que a equipe apagou depois some do formulário, mas segue no gravado.
  assert.deepEqual(valoresIniciais([campo({ id: 'c9', label: 'Novo' })], gravados), { c9: '' });
  assert.equal(lerPersistidos(null).length, 0);
});

test('camposDoApontamento cai nos legados quando o registro é antigo', () => {
  const novo = { campos: [{ id: 'c1', label: 'Sigla', valor: 'PTA' }] };
  assert.deepEqual(camposDoApontamento(novo), [{ id: 'c1', label: 'Sigla', valor: 'PTA' }]);

  // Catálogo fixo da empresa (4 colunas), na ordem em que era exibido.
  const catalogo = { campos: [], sigla: 'PTA', tarefa: '6WLA', etiqueta: '', tarefa2: 'REVISAR' };
  assert.deepEqual(
    camposDoApontamento(catalogo).map((c) => [c.label, c.valor]),
    [
      ['Sigla', 'PTA'],
      ['Tarefa', '6WLA'],
      ['Tarefa 2', 'REVISAR'],
    ]
  );

  // Atividades controladas por gerência (o legado mais antigo, posicional).
  assert.deepEqual(camposDoApontamento({ ativ: ['Civil', '', 'Obra'] }).map((c) => c.label), [
    'Atividade 1',
    'Atividade 3',
  ]);

  assert.deepEqual(camposDoApontamento({}), []);
});

test('labelsUsados/valorDoCampo trabalham pelo rótulo (listagem mistura equipes)', () => {
  const list = [
    { campos: [{ id: 'a', label: 'Sigla', valor: 'PTA' }, { id: 'b', label: 'Frente', valor: 'Civil' }] },
    { campos: [{ id: 'z', label: 'sigla', valor: 'POP' }, { id: 'y', label: 'Disciplina', valor: 'Elétrica' }] },
  ];
  // "Sigla" e "sigla" (ids diferentes, equipes diferentes) viram UMA coluna só.
  assert.deepEqual(labelsUsados(list), ['Sigla', 'Frente', 'Disciplina']);
  assert.equal(valorDoCampo(list[1], 'Sigla'), 'POP');
  assert.equal(valorDoCampo(list[0], 'Disciplina'), '');
});
