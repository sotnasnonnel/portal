import { test } from 'node:test';
import assert from 'node:assert/strict';
import { descreverPrazo } from './prazoTexto.js';

// Horário local fixo: o texto usa o dia do calendário de quem está olhando.
const agora = new Date(2026, 10, 5, 10, 0).getTime();
const em = (dia, h = 12, min = 0) => new Date(2026, 10, dia, h, min).toISOString();

test('sem data ou com data inválida não inventa prazo', () => {
  assert.equal(descreverPrazo(null, agora), 'Sem prazo');
  assert.equal(descreverPrazo('', agora), 'Sem prazo');
  assert.equal(descreverPrazo('não é data', agora), 'Sem prazo');
});

test('prazo futuro diz quanto falta', () => {
  assert.equal(descreverPrazo(em(5, 16, 30), agora), 'Vence hoje às 16:30');
  assert.equal(descreverPrazo(em(6, 9, 5), agora), 'Vence amanhã às 09:05');
  assert.equal(descreverPrazo(em(8), agora), 'Vence em 3 dias');
});

test('prazo estourado diz há quanto tempo', () => {
  assert.equal(descreverPrazo(em(5, 8, 15), agora), 'Venceu hoje às 08:15');
  assert.equal(descreverPrazo(em(4), agora), 'Venceu ontem');
  assert.equal(descreverPrazo(em(2), agora), 'Venceu há 3 dias');
});

test('a conta é por dia do calendário, não por blocos de 24 horas', () => {
  // Faltam só 15 horas, mas o prazo já é o dia seguinte.
  assert.equal(descreverPrazo(em(6, 1, 0), agora), 'Vence amanhã às 01:00');
  // Passou há menos de 24 horas, mas foi ontem.
  assert.equal(descreverPrazo(em(4, 23, 0), agora), 'Venceu ontem');
});
