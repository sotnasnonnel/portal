import test from 'node:test';
import assert from 'node:assert/strict';
import { formatarDataHora } from './formatters.js';

test('data e hora com ano de quatro dígitos, sem vírgula', () => {
  // Hora local, para o teste não depender do fuso da máquina.
  const iso = new Date(2026, 9, 7, 9, 5).toISOString();
  assert.equal(formatarDataHora(iso), '07/10/2026 09:05');
});

test('sem data devolve o texto de vazio escolhido', () => {
  assert.equal(formatarDataHora(null), '—');
  assert.equal(formatarDataHora('', 'sem prazo'), 'sem prazo');
  assert.equal(formatarDataHora('não é data', ''), '');
});
