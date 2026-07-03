import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskCurrencyInput, parseCurrency } from './currencyMask.js';

test('maskCurrencyInput agrupa milhar sem casas decimais', () => {
  assert.equal(maskCurrencyInput('1'), '1');
  assert.equal(maskCurrencyInput('12'), '12');
  assert.equal(maskCurrencyInput('1200'), '1.200');
  assert.equal(maskCurrencyInput('12000'), '12.000');
  assert.equal(maskCurrencyInput('1200000'), '1.200.000');
});

test('maskCurrencyInput trata a vírgula como centavos, no máx 2 casas', () => {
  assert.equal(maskCurrencyInput('12000,5'), '12.000,5');
  assert.equal(maskCurrencyInput('12000,50'), '12.000,50');
  assert.equal(maskCurrencyInput('12000,509'), '12.000,50');
});

test('maskCurrencyInput preserva a vírgula pendente enquanto digita', () => {
  assert.equal(maskCurrencyInput('12000,'), '12.000,');
});

test('maskCurrencyInput assume 0 quando começa pela vírgula', () => {
  assert.equal(maskCurrencyInput(',50'), '0,50');
});

test('maskCurrencyInput descarta letras e vírgulas extras', () => {
  assert.equal(maskCurrencyInput('R$ 12abc00'), '1.200');
  assert.equal(maskCurrencyInput('12,,5'), '12,5');
});

test('maskCurrencyInput remove zeros à esquerda, preservando um zero', () => {
  assert.equal(maskCurrencyInput('01'), '1');
  assert.equal(maskCurrencyInput('00'), '0');
  assert.equal(maskCurrencyInput('0'), '0');
});

test('maskCurrencyInput trata vazio e null', () => {
  assert.equal(maskCurrencyInput(''), '');
  assert.equal(maskCurrencyInput(null), '');
});

test('parseCurrency converte a string mascarada em número', () => {
  assert.equal(parseCurrency('12.000'), 12000);
  assert.equal(parseCurrency('12.000,50'), 12000.5);
  assert.equal(parseCurrency('1.200.000'), 1200000);
  assert.equal(parseCurrency('0'), 0);
});

test('parseCurrency retorna null para vazio/nulo', () => {
  assert.equal(parseCurrency(''), null);
  assert.equal(parseCurrency(null), null);
});
