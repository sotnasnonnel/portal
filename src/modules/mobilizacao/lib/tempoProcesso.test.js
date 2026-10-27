import test from 'node:test';
import assert from 'node:assert/strict';
import {
  tempoTotalDias, tempoTotalTexto, tempoMedioDias, estaConcluido, inicioDoProcesso,
} from './tempoProcesso.js';

const HOJE = new Date(2026, 8, 29, 9, 0, 0); // 29/09/2026

// 01/09/2026 é terça; 15/09 também. De terça a terça, duas semanas: 10 úteis
// depois do dia da abertura.
test('processo concluído conta da abertura até a última data real, em dias úteis', () => {
  const p = { data_base: '2026-09-01', concluido_real: '2026-09-15' };
  assert.equal(tempoTotalDias(p, HOJE), 10);
  assert.equal(tempoTotalTexto(p, HOJE), '10 dias');
});

// Os exemplos da Edijane (29/09/2026), sem a ponta da abertura (27/10/2026).
test('em andamento conta até hoje, em dias úteis e sem o dia da abertura', () => {
  assert.equal(tempoTotalDias({ data_base: '2026-09-25' }, HOJE), 2, '#140: seg, ter');
  assert.equal(tempoTotalDias({ data_base: '2026-09-17' }, HOJE), 8, '#137');
  assert.equal(tempoTotalTexto({ data_base: '2026-09-28' }, HOJE), '1 dia', 'aberto ontem');
  assert.equal(tempoTotalTexto({ data_base: '2026-09-29' }, HOJE), '0 dias', 'aberto hoje');
});

// #367: aberto em 26/10 com data-base 13/11 mostrava 0 dia.
test('o começo é o "Aberto em" quando a data-base vem depois', () => {
  const p = { criado_em: new Date(2026, 8, 25, 10, 0).toISOString(), data_base: '2026-10-13' };
  assert.equal(inicioDoProcesso(p), '2026-09-25');
  assert.equal(tempoTotalDias(p, HOJE), 2);
});

// Os da planilha nasceram no portal no dia da carga; o começo real é a data-base.
test('o começo é a data-base quando ela vem antes da abertura', () => {
  const p = { criado_em: new Date(2026, 8, 9, 10, 0).toISOString(), data_base: '2026-09-01' };
  assert.equal(inicioDoProcesso(p), '2026-09-01');
});

test('sem data-base, conta pela abertura', () => {
  assert.equal(inicioDoProcesso({ criado_em: new Date(2026, 8, 28, 23, 30).toISOString() }), '2026-09-28');
});

test('fim de semana não conta', () => {
  assert.equal(tempoTotalDias({ data_base: '2026-09-26', concluido_real: '2026-09-27' }, HOJE), 0);
  assert.equal(tempoTotalDias({ data_base: '2026-09-26', concluido_real: '2026-09-28' }, HOJE), 1);
});

// concluido_em é o dia em que o portal marcou a conclusão — nos importados, o
// dia da carga. Se ele vazasse para a conta, a média iria de 17 para 114 dias.
test('concluido_em não entra na conta', () => {
  const p = { data_base: '2026-09-01', concluido_em: '2026-12-31T10:00:00Z' };
  assert.equal(tempoTotalDias(p, HOJE), 20, 'sem data real, conta contra hoje');
});

test('sem abertura nem data-base não há o que contar', () => {
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
    { data_base: '2026-09-01', concluido_real: '2026-09-11' }, // 8 úteis
    { data_base: '2026-09-01', concluido_real: '2026-09-21' }, // 14 úteis
    { data_base: '2026-09-28' },                               // em andamento: fora
  ];
  assert.deepEqual(tempoMedioDias(lista, HOJE), { media: 11, total: 2 });
});

test('sem nenhum concluído, a média é nula — nunca zero', () => {
  assert.deepEqual(tempoMedioDias([{ data_base: '2026-09-28' }], HOJE), { media: null, total: 0 });
  assert.deepEqual(tempoMedioDias([], HOJE), { media: null, total: 0 });
});

// Dia começado é dia gasto: a média vai para cima, nunca para baixo.
test('a média arredonda para cima', () => {
  const lista = [
    { data_base: '2026-09-01', concluido_real: '2026-09-11' }, // 8 úteis
    { data_base: '2026-09-01', concluido_real: '2026-09-14' }, // 9 úteis
    { data_base: '2026-09-01', concluido_real: '2026-09-14' }, // 9 úteis
  ];
  // (8 + 9 + 9) / 3 = 8,67
  assert.equal(tempoMedioDias(lista, HOJE).media, 9);
});

test('média exata não ganha um dia a mais', () => {
  const lista = [
    { data_base: '2026-09-01', concluido_real: '2026-09-11' }, // 8 úteis
    { data_base: '2026-09-01', concluido_real: '2026-09-11' }, // 8 úteis
  ];
  assert.equal(tempoMedioDias(lista, HOJE).media, 8);
});
