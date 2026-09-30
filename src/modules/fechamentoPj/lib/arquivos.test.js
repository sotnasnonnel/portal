import test from 'node:test';
import assert from 'node:assert/strict';
import { serialExcel } from './arquivos.js';

// O SheetJS 0.18 gravava 30/09/2026 como 46294,9997 (o Excel mostrava 29/09):
// descontava o fuso histórico de São Paulo em 1899. O serial à mão não depende
// de fuso nenhum.
test('meia-noite local vira o dia exato, sem fração', () => {
  assert.equal(serialExcel(new Date(2026, 8, 30)), 46295);
  assert.equal(serialExcel(new Date(1900, 0, 1)), 2);
});

test('a hora local vira a fração do dia, sem trocar o dia', () => {
  assert.equal(serialExcel(new Date(2026, 8, 30, 12)), 46295.5);
  const noite = serialExcel(new Date(2026, 8, 29, 22, 15));
  assert.equal(Math.floor(noite), 46294, '22h15 do dia 29 continua dia 29');
});
