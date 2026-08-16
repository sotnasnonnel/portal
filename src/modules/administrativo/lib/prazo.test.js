import test from 'node:test';
import assert from 'node:assert/strict';
import { ehDiaUtil, proximoDiaUtil, venceEmDiasUteis } from './prazo.js';

// Datas locais para o teste não depender de fuso.
const em = (aaaammdd, hora = '09:00') => new Date(`${aaaammdd}T${hora}:00`);
const dia = (d) => d.toISOString().slice(0, 10);
const hora = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// 10/08/2026 é uma segunda-feira.
test('reconhece dia útil e fim de semana', () => {
  assert.equal(ehDiaUtil(em('2026-08-10')), true, 'segunda');
  assert.equal(ehDiaUtil(em('2026-08-14')), true, 'sexta');
  assert.equal(ehDiaUtil(em('2026-08-15')), false, 'sábado');
  assert.equal(ehDiaUtil(em('2026-08-16')), false, 'domingo');
});

test('dentro da semana, dia útil é dia corrido', () => {
  assert.equal(dia(venceEmDiasUteis(em('2026-08-10'), 2)), '2026-08-12');
});

// O motivo de existir este módulo: sexta + 2 não pode cair no domingo.
test('sexta mais dois dias úteis cai na terça, não no domingo', () => {
  assert.equal(dia(venceEmDiasUteis(em('2026-08-14'), 2)), '2026-08-18');
});

test('atravessar o fim de semana pula sábado e domingo', () => {
  assert.equal(dia(venceEmDiasUteis(em('2026-08-13'), 1)), '2026-08-14', 'quinta + 1 = sexta');
  assert.equal(dia(venceEmDiasUteis(em('2026-08-14'), 1)), '2026-08-17', 'sexta + 1 = segunda');
});

// Chamado aprovado no fim de semana: o relógio começa na segunda.
test('começar no fim de semana empurra para a segunda antes de contar', () => {
  assert.equal(dia(proximoDiaUtil(em('2026-08-15'))), '2026-08-17');
  assert.equal(dia(venceEmDiasUteis(em('2026-08-15'), 1)), '2026-08-18', 'sábado + 1 = terça');
  assert.equal(dia(venceEmDiasUteis(em('2026-08-16'), 2)), '2026-08-19', 'domingo + 2 = quarta');
});

test('a hora do dia é preservada', () => {
  assert.equal(hora(venceEmDiasUteis(em('2026-08-14', '15:30'), 3)), '15:30');
});

test('semanas inteiras somam de cinco em cinco', () => {
  assert.equal(dia(venceEmDiasUteis(em('2026-08-10'), 5)), '2026-08-17');
  assert.equal(dia(venceEmDiasUteis(em('2026-08-10'), 10)), '2026-08-24');
});

// Serviço sem prazo cadastrado não ganha vencimento inventado.
test('sem prazo definido, não há vencimento', () => {
  assert.equal(venceEmDiasUteis(em('2026-08-10'), null), null);
  assert.equal(venceEmDiasUteis(em('2026-08-10'), 0), null);
  assert.equal(venceEmDiasUteis(em('2026-08-10'), 'abc'), null);
});

test('não altera a data recebida', () => {
  const inicio = em('2026-08-10');
  venceEmDiasUteis(inicio, 3);
  assert.equal(dia(inicio), '2026-08-10');
});
