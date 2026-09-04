import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COLUNAS_KANBAN, statusAoSoltar, agruparEmColunas, podeMover, podeEditar,
  progresso, iniciais, filtrarFila, opcoesDaFila,
} from './painelEtapas.js';

const etapa = (over = {}) => ({
  id: 'e1', codigo: 'exames', titulo: 'Exames', status: 'pendente',
  depende_de: null, responsavel_id: null, dias_atraso: null, ...over,
});

test('o quadro não mostra etapa dispensada', () => {
  const chaves = COLUNAS_KANBAN.flatMap((c) => c.status);
  assert.ok(!chaves.includes('dispensada'), 'dispensada só aparece na fila, por filtro');
  assert.deepEqual(COLUNAS_KANBAN.map((c) => c.chave), ['pendente', 'em_andamento', 'concluida']);
});

test('soltar na coluna define o status', () => {
  assert.equal(statusAoSoltar('pendente'), 'pendente');
  assert.equal(statusAoSoltar('concluida'), 'concluida');
  assert.equal(statusAoSoltar('coluna-que-nao-existe'), null);
});

test('agrupa as etapas nas colunas', () => {
  const cols = agruparEmColunas([
    etapa({ id: 'a', status: 'pendente' }),
    etapa({ id: 'b', status: 'em_andamento' }),
    etapa({ id: 'c', status: 'concluida' }),
    etapa({ id: 'd', status: 'dispensada' }),
  ]);
  assert.deepEqual(cols.map((c) => c.itens.length), [1, 1, 1], 'a dispensada fica de fora');
});

// A trava que existe para o prazo não contar a partir de uma mentira.
test('não conclui etapa cujo predecessor está aberto', () => {
  const anterior = etapa({ id: 'a', codigo: 'exames', titulo: 'Exames', status: 'pendente' });
  const atual = etapa({ id: 'b', codigo: 'aso', titulo: 'ASO', depende_de: 'exames' });

  const r = podeMover(atual, 'concluida', [anterior, atual]);
  assert.equal(r.ok, false);
  assert.match(r.motivo, /Exames/, 'o motivo nomeia o passo que falta');
});

test('predecessor concluído libera, e dispensado também', () => {
  const atual = etapa({ codigo: 'aso', depende_de: 'exames' });
  for (const st of ['concluida', 'dispensada']) {
    const anterior = etapa({ codigo: 'exames', status: st });
    assert.equal(podeMover(atual, 'concluida', [anterior, atual]).ok, true, st);
  }
});

// Pegar um passo adiantado é normal; o que não dá é dizer que terminou.
test('a dependência só trava a conclusão, não o começo', () => {
  const anterior = etapa({ codigo: 'exames', status: 'pendente' });
  const atual = etapa({ codigo: 'aso', depende_de: 'exames' });
  assert.equal(podeMover(atual, 'em_andamento', [anterior, atual]).ok, true);
});

// Dependência de algo que nunca vai acontecer prenderia a etapa para sempre.
test('predecessor que não existe no processo não trava', () => {
  const atual = etapa({ codigo: 'aso', depende_de: 'etapa_condicional_que_nao_nasceu' });
  assert.equal(podeMover(atual, 'concluida', [atual]).ok, true);
});

test('mover para a coluna em que já está é sempre permitido', () => {
  const atual = etapa({ codigo: 'aso', depende_de: 'exames', status: 'concluida' });
  const anterior = etapa({ codigo: 'exames', status: 'pendente' });
  assert.equal(podeMover(atual, 'concluida', [anterior, atual]).ok, true);
});

test('quem pode gravar a etapa', () => {
  const minha = etapa({ responsavel_id: 'eu' });
  const alheia = etapa({ responsavel_id: 'outro' });
  const orfa = etapa({ responsavel_id: null });

  assert.equal(podeEditar(minha, { meuId: 'eu' }), true);
  assert.equal(podeEditar(alheia, { meuId: 'eu' }), false);
  assert.equal(podeEditar(orfa, { meuId: 'eu' }), false, 'sem dono, só o time mexe');
  assert.equal(podeEditar(alheia, { meuId: 'eu', souTime: true }), true);
  assert.equal(podeEditar(minha, {}), false, 'sem sessão não edita nada');
});

test('progresso do processo', () => {
  assert.deepEqual(progresso({ etapas_total: 11, etapas_concluidas: 4 }), { total: 11, feitas: 4, pct: 36 });
  assert.deepEqual(progresso({ etapas_total: 0, etapas_concluidas: 0 }), { total: 0, feitas: 0, pct: 0 },
    'catálogo vazio não vira divisão por zero');
  assert.deepEqual(progresso(undefined), { total: 0, feitas: 0, pct: 0 });
});

test('iniciais para o avatar', () => {
  assert.equal(iniciais('Edijane Alves Souza'), 'ES');
  assert.equal(iniciais('Ivone'), 'IV');
  assert.equal(iniciais(''), '?');
  assert.equal(iniciais(null), '?');
});

test('a fila esconde as encerradas por padrão', () => {
  const lista = [
    etapa({ id: 'a', status: 'pendente' }),
    etapa({ id: 'b', status: 'concluida' }),
    etapa({ id: 'c', status: 'dispensada' }),
  ];
  assert.equal(filtrarFila(lista, {}).length, 1);
  assert.equal(filtrarFila(lista, { incluirEncerradas: true }).length, 3);
  assert.equal(filtrarFila(lista, { status: 'concluida' }).length, 1,
    'pedir explicitamente por concluídas mostra as concluídas');
});

test('busca sem acento e sem caixa, no passo e no processo', () => {
  const lista = [
    etapa({ id: 'a', titulo: 'Emissão do ASO' }),
    etapa({ id: 'b', titulo: 'Exames', processoTitulo: 'GUILHERME DE ASSIS' }),
  ];
  assert.equal(filtrarFila(lista, { busca: 'emissao' })[0].id, 'a');
  assert.equal(filtrarFila(lista, { busca: 'guilherme' })[0].id, 'b');
});

test('filtro de sem responsável e de atrasadas', () => {
  const lista = [
    etapa({ id: 'a', responsavel_id: 'x', dias_atraso: 3 }),
    etapa({ id: 'b', responsavel_id: null, dias_atraso: -2 }),
    etapa({ id: 'c', responsavel_id: 'x', dias_atraso: 5, status: 'concluida' }),
  ];
  assert.equal(filtrarFila(lista, { responsavelId: 'sem' })[0].id, 'b');
  const atrasadas = filtrarFila(lista, { atrasadas: true });
  assert.deepEqual(atrasadas.map((e) => e.id), ['a'],
    'concluída com atraso não é "atrasada": já foi contada no cumprimento de prazo');
});

test('opções saem do que está na fila, não do cadastro', () => {
  const o = opcoesDaFila([
    etapa({ responsavel_id: 'i1', responsavelNome: 'Ivone', fluxo: 'mobilizacao_pessoa' }),
    etapa({ responsavel_id: 'e1', responsavelNome: 'Edijane', fluxo: 'mobilizacao_pessoa' }),
    etapa({ responsavel_id: null, fluxo: 'mobilizacao_empresa' }),
  ]);
  assert.deepEqual(o.responsaveis.map((r) => r.label), ['Edijane', 'Ivone'], 'em ordem alfabética');
  assert.deepEqual(o.fluxos, ['mobilizacao_empresa', 'mobilizacao_pessoa']);
  assert.equal(o.temSemResponsavel, true);
});
