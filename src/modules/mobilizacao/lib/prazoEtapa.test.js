import test from 'node:test';
import assert from 'node:assert/strict';
import {
  projetarDatas, diasAtraso, estaAtrasada, prazoDoProcesso,
} from './prazoEtapa.js';

// A cadeia real de MOB.PESSOAS, como as fórmulas da planilha a definem.
// 10/08/2026 é uma segunda-feira.
const FLUXO_PESSOA = [
  { codigo: 'abertura', depende_de: null, sla_dias_uteis: 0 },
  { codigo: 'exames', depende_de: 'abertura', sla_dias_uteis: 7 },
  { codigo: 'aso', depende_de: 'exames', sla_dias_uteis: 2 },
  { codigo: 'treinamentos', depende_de: 'abertura', sla_dias_uteis: 1 },
  { codigo: 'conclusao_trein', depende_de: 'treinamentos', sla_dias_uteis: 7 },
];

test('a etapa raiz parte da data-base', () => {
  const d = projetarDatas(FLUXO_PESSOA, '2026-08-10');
  assert.equal(d.abertura, '2026-08-10');
});

test('cada etapa soma o SLA em dias úteis sobre a anterior', () => {
  const d = projetarDatas(FLUXO_PESSOA, '2026-08-10');
  assert.equal(d.exames, '2026-08-19', 'segunda + 7 úteis');
  assert.equal(d.aso, '2026-08-21', 'exames + 2 úteis');
});

// A árvore: treinamento pende da ABERTURA, não dos exames. Amarrá-los em série
// inventaria atraso que a operação não tem.
test('ramos paralelos não se somam', () => {
  const d = projetarDatas(FLUXO_PESSOA, '2026-08-10');
  assert.equal(d.treinamentos, '2026-08-11', 'abertura + 1, e não depois dos exames');
  assert.equal(d.conclusao_trein, '2026-08-20');
});

// O comportamento que separa este módulo do Adm: o prazo se reajusta sozinho
// quando a etapa anterior conclui DE VERDADE.
test('a data real do predecessor reprojeta o resto da cadeia', () => {
  const comAtraso = FLUXO_PESSOA.map((e) => (e.codigo === 'exames'
    ? { ...e, data_real: '2026-08-26' } : e));
  const d = projetarDatas(comAtraso, '2026-08-10');
  assert.equal(d.aso, '2026-08-28', 'conta da data real dos exames, não da prevista');
  assert.equal(d.treinamentos, '2026-08-11', 'o outro ramo não se mexe');
});

test('sem data-base, nenhuma etapa tem prazo', () => {
  const d = projetarDatas(FLUXO_PESSOA, null);
  assert.equal(d.abertura, null);
  assert.equal(d.exames, null);
  assert.equal(d.aso, null);
});

test('a ordem do array não importa', () => {
  const embaralhado = [...FLUXO_PESSOA].reverse();
  assert.deepEqual(projetarDatas(embaralhado, '2026-08-10'), projetarDatas(FLUXO_PESSOA, '2026-08-10'));
});

// O laço é limitado pelo número de etapas justamente para isto não travar.
test('ciclo não trava a projeção', () => {
  const d = projetarDatas([
    { codigo: 'a', depende_de: 'b', sla_dias_uteis: 1 },
    { codigo: 'b', depende_de: 'a', sla_dias_uteis: 1 },
  ], '2026-08-10');
  assert.equal(d.a, null);
  assert.equal(d.b, null);
});

test('atraso é a diferença entre o que aconteceu e o previsto', () => {
  assert.equal(diasAtraso({ data_prevista: '2026-08-10', data_real: '2026-08-13', status: 'concluida' }), 3);
  assert.equal(diasAtraso({ data_prevista: '2026-08-10', data_real: '2026-08-07', status: 'concluida' }), -3,
    'adiantado é negativo');
});

test('enquanto não conclui, o relógio corre contra hoje', () => {
  const e = { data_prevista: '2026-08-10', status: 'pendente' };
  assert.equal(diasAtraso(e, '2026-08-14'), 4);
  assert.equal(diasAtraso(e, '2026-08-08'), -2);
});

test('sem prazo e dispensada não têm atraso', () => {
  assert.equal(diasAtraso({ status: 'pendente' }, '2026-08-14'), null);
  assert.equal(diasAtraso({ data_prevista: '2026-08-10', status: 'dispensada' }, '2026-08-14'), null);
});

test('só o que ainda está em jogo conta como atrasado', () => {
  const vencida = { data_prevista: '2026-08-10', status: 'pendente' };
  const concluidaTarde = { data_prevista: '2026-08-10', data_real: '2026-08-20', status: 'concluida' };
  assert.equal(estaAtrasada(vencida, '2026-08-14'), true);
  assert.equal(estaAtrasada(concluidaTarde, '2026-08-25'), false,
    'já entrou no indicador de cumprimento; somar contaria duas vezes');
});

// O maior, e não o menor: o processo só acaba quando o último passo acaba.
test('o prazo do processo é o maior prazo pendente', () => {
  const prazo = prazoDoProcesso([
    { status: 'concluida', data_prevista: '2026-09-30' },
    { status: 'pendente', data_prevista: '2026-08-12' },
    { status: 'pendente', data_prevista: '2026-08-25' },
  ]);
  assert.equal(prazo, '2026-08-25');
});

test('processo sem etapa pendente não tem prazo', () => {
  assert.equal(prazoDoProcesso([{ status: 'concluida', data_prevista: '2026-08-12' }]), null);
  assert.equal(prazoDoProcesso([]), null);
});
