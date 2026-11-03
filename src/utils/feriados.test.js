import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ehFeriado, nomeDoFeriado, pascoa, semExpediente } from './feriados.js';

const dia = (a, m, d) => new Date(a, m - 1, d, 9, 0);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

test('Páscoa confere com a efeméride', () => {
  // Datas publicadas, para pegar erro de algoritmo e não só de digitação.
  assert.equal(iso(pascoa(2024)), '2024-03-31');
  assert.equal(iso(pascoa(2025)), '2025-04-20');
  assert.equal(iso(pascoa(2026)), '2026-04-05');
  assert.equal(iso(pascoa(2027)), '2027-03-28');
  assert.equal(iso(pascoa(2030)), '2030-04-21');
  assert.equal(iso(pascoa(2038)), '2038-04-25'); // o limite tardio do calendário
});

test('feriado fixo nacional', () => {
  assert.equal(nomeDoFeriado(dia(2026, 11, 2)), 'Finados');
  assert.equal(nomeDoFeriado(dia(2026, 1, 1)), 'Confraternização Universal');
  assert.equal(nomeDoFeriado(dia(2026, 12, 25)), 'Natal');
  assert.equal(nomeDoFeriado(dia(2026, 11, 3)), null);
});

test('Consciência Negra só a partir de 2024, quando virou nacional', () => {
  assert.equal(ehFeriado(dia(2023, 11, 20)), false);
  assert.equal(ehFeriado(dia(2024, 11, 20)), true);
});

test('os móveis saem da Páscoa de cada ano', () => {
  // Páscoa de 2026 em 05/04: Carnaval 16 e 17/02, Sexta-feira Santa 03/04,
  // Corpus Christi 04/06.
  assert.equal(nomeDoFeriado(dia(2026, 2, 16)), 'Carnaval (segunda)');
  assert.equal(nomeDoFeriado(dia(2026, 2, 17)), 'Carnaval');
  assert.equal(nomeDoFeriado(dia(2026, 4, 3)), 'Sexta-feira Santa');
  assert.equal(nomeDoFeriado(dia(2026, 6, 4)), 'Corpus Christi');
  // A quarta-feira de cinzas tem expediente.
  assert.equal(ehFeriado(dia(2026, 2, 18)), false);
  // Em 2027 o Carnaval anda para fevereiro/março: 08 e 09/02.
  assert.equal(nomeDoFeriado(dia(2027, 2, 9)), 'Carnaval');
  assert.equal(ehFeriado(dia(2027, 2, 17)), false);
});

test('municipal da sede em Belo Horizonte', () => {
  assert.equal(nomeDoFeriado(dia(2026, 12, 8)), 'Nossa Senhora da Conceição (Belo Horizonte)');
});

test('sem expediente é fim de semana ou feriado', () => {
  assert.equal(semExpediente(dia(2026, 10, 17)), true); // sábado
  assert.equal(semExpediente(dia(2026, 10, 18)), true); // domingo
  assert.equal(semExpediente(dia(2026, 11, 2)), true); // segunda de Finados
  assert.equal(semExpediente(dia(2026, 11, 3)), false); // terça comum
});

test('data ausente ou inválida não é feriado nem dia parado', () => {
  assert.equal(nomeDoFeriado(null), null);
  assert.equal(nomeDoFeriado(new Date('x')), null);
  assert.equal(semExpediente(undefined), false);
  assert.equal(semExpediente(new Date('x')), false);
});
