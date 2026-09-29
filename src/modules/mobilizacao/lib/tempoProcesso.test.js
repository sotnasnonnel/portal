import test from 'node:test';
import assert from 'node:assert/strict';
import {
  tempoTotalDias, tempoTotalTexto, tempoMedioDias, estaConcluido,
} from './tempoProcesso.js';

const HOJE = new Date(2026, 8, 29, 9, 0, 0); // 29/09/2026

test('processo concluído conta da data-base até a última data real', () => {
  const p = { data_base: '2026-09-01', concluido_real: '2026-09-15' };
  assert.equal(tempoTotalDias(p, HOJE), 14);
  assert.equal(tempoTotalTexto(p, HOJE), '14 dias');
});

test('processo em andamento conta até hoje', () => {
  assert.equal(tempoTotalDias({ data_base: '2026-09-25' }, HOJE), 4);
  assert.equal(tempoTotalTexto({ data_base: '2026-09-28' }, HOJE), '1 dia');
});

// concluido_em é o dia em que o portal marcou a conclusão — nos importados, o
// dia da carga. Se ele vazasse para a conta, a média iria de 17 para 114 dias.
test('concluido_em não entra na conta', () => {
  const p = { data_base: '2026-09-01', concluido_em: '2026-12-31T10:00:00Z' };
  assert.equal(tempoTotalDias(p, HOJE), 28, 'sem data real, conta contra hoje');
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
    { data_base: '2026-09-01', concluido_real: '2026-09-11' }, // 10
    { data_base: '2026-09-01', concluido_real: '2026-09-21' }, // 20
    { data_base: '2026-09-28' },                               // em andamento: fora
  ];
  assert.deepEqual(tempoMedioDias(lista, HOJE), { media: 15, total: 2 });
});

test('sem nenhum concluído, a média é nula — nunca zero', () => {
  assert.deepEqual(tempoMedioDias([{ data_base: '2026-09-28' }], HOJE), { media: null, total: 0 });
  assert.deepEqual(tempoMedioDias([], HOJE), { media: null, total: 0 });
});

// Dia começado é dia gasto: a média vai para cima, nunca para baixo.
test('a média arredonda para cima', () => {
  const lista = [
    { data_base: '2026-09-01', concluido_real: '2026-09-11' }, // 10
    { data_base: '2026-09-01', concluido_real: '2026-09-12' }, // 11
    { data_base: '2026-09-01', concluido_real: '2026-09-12' }, // 11
  ];
  // (10 + 11 + 11) / 3 = 10,67
  assert.equal(tempoMedioDias(lista, HOJE).media, 11);
});

test('média exata não ganha um dia a mais', () => {
  const lista = [
    { data_base: '2026-09-01', concluido_real: '2026-09-11' }, // 10
    { data_base: '2026-09-01', concluido_real: '2026-09-11' }, // 10
  ];
  assert.equal(tempoMedioDias(lista, HOJE).media, 10);
});
