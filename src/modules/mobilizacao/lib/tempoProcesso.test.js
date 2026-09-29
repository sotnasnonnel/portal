import test from 'node:test';
import assert from 'node:assert/strict';
import {
  tempoTotalDias, tempoTotalTexto, tempoMedioDias, estaConcluido,
} from './tempoProcesso.js';

const HOJE = new Date(2026, 8, 29, 9, 0, 0); // 29/09/2026

// 01/09/2026 é terça; 15/09 também. De terça a terça, duas semanas: 11 úteis.
test('processo concluído conta da data-base até a última data real, em dias úteis', () => {
  const p = { data_base: '2026-09-01', concluido_real: '2026-09-15' };
  assert.equal(tempoTotalDias(p, HOJE), 11);
  assert.equal(tempoTotalTexto(p, HOJE), '11 dias');
});

// Os dois exemplos do chamado da Edijane (29/09/2026).
test('em andamento conta até hoje, em dias úteis e com as duas pontas', () => {
  assert.equal(tempoTotalDias({ data_base: '2026-09-25' }, HOJE), 3, '#140: sex, seg, ter');
  assert.equal(tempoTotalDias({ data_base: '2026-09-17' }, HOJE), 9, '#137');
  assert.equal(tempoTotalTexto({ data_base: '2026-09-29' }, HOJE), '1 dia');
});

test('fim de semana não conta', () => {
  assert.equal(tempoTotalDias({ data_base: '2026-09-26', concluido_real: '2026-09-27' }, HOJE), 0);
  assert.equal(tempoTotalDias({ data_base: '2026-09-26', concluido_real: '2026-09-28' }, HOJE), 1);
});

// concluido_em é o dia em que o portal marcou a conclusão — nos importados, o
// dia da carga. Se ele vazasse para a conta, a média iria de 17 para 114 dias.
test('concluido_em não entra na conta', () => {
  const p = { data_base: '2026-09-01', concluido_em: '2026-12-31T10:00:00Z' };
  assert.equal(tempoTotalDias(p, HOJE), 21, 'sem data real, conta contra hoje');
});

test('sem data-base não há o que contar', () => {
  assert.equal(tempoTotalDias({}, HOJE), null);
  assert.equal(tempoTotalTexto({}, HOJE), '—');
  assert.equal(tempoTotalDias(null, HOJE), null);
});

// Planilha preenchida a mão tem linha com a última etapa anterior à data-base.
test('duração negativa vira zero', () => {
  assert.equal(tempoTotalDias({ data_base: '2026-09-10', concluido_real: '2026-09-05' }, HOJE), 0);
});

test('estaConcluido separa quem já terminou', () => {
  assert.equal(estaConcluido({ concluido_real: '2026-09-15' }), true);
  assert.equal(estaConcluido({ data_base: '2026-09-01' }), false);
});

test('a média usa só os concluídos', () => {
  const lista = [
    { data_base: '2026-09-01', concluido_real: '2026-09-11' }, // 9 úteis
    { data_base: '2026-09-01', concluido_real: '2026-09-21' }, // 15 úteis
    { data_base: '2026-09-28' },                               // em andamento: fora
  ];
  assert.deepEqual(tempoMedioDias(lista, HOJE), { media: 12, total: 2 });
});

test('sem nenhum concluído, a média é nula — nunca zero', () => {
  assert.deepEqual(tempoMedioDias([{ data_base: '2026-09-28' }], HOJE), { media: null, total: 0 });
  assert.deepEqual(tempoMedioDias([], HOJE), { media: null, total: 0 });
});

// Dia começado é dia gasto: a média vai para cima, nunca para baixo.
test('a média arredonda para cima', () => {
  const lista = [
    { data_base: '2026-09-01', concluido_real: '2026-09-11' }, // 9 úteis
    { data_base: '2026-09-01', concluido_real: '2026-09-14' }, // 10 úteis
    { data_base: '2026-09-01', concluido_real: '2026-09-14' }, // 10 úteis
  ];
  // (9 + 10 + 10) / 3 = 9,67
  assert.equal(tempoMedioDias(lista, HOJE).media, 10);
});

test('média exata não ganha um dia a mais', () => {
  const lista = [
    { data_base: '2026-09-01', concluido_real: '2026-09-11' }, // 9 úteis
    { data_base: '2026-09-01', concluido_real: '2026-09-11' }, // 9 úteis
  ];
  assert.equal(tempoMedioDias(lista, HOJE).media, 9);
});
