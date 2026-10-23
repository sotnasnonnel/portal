import test from 'node:test';
import assert from 'node:assert/strict';
import { nomesSemRepetir, temPdf } from './pdfLote.js';

test('só aprovado tem PDF', () => {
  assert.equal(temPdf({ status: 'aprovado' }), true);
  for (const status of ['rascunho', 'em_analise', 'reprovado', 'cancelado']) {
    assert.equal(temPdf({ status }), false);
  }
  assert.equal(temPdf(null), false);
});

test('nomes diferentes ficam como estão', () => {
  assert.deepEqual(nomesSemRepetir(['a.pdf', 'b.pdf']), ['a.pdf', 'b.pdf']);
});

test('repetido ganha (2), (3)... antes do .pdf', () => {
  assert.deepEqual(
    nomesSemRepetir(['2026.09_X_R$50,00.pdf', '2026.09_X_R$50,00.pdf', '2026.09_X_R$50,00.pdf']),
    ['2026.09_X_R$50,00.pdf', '2026.09_X_R$50,00 (2).pdf', '2026.09_X_R$50,00 (3).pdf'],
  );
});

test('maiúscula e minúscula contam como o mesmo nome', () => {
  assert.deepEqual(nomesSemRepetir(['Ana.pdf', 'ANA.pdf']), ['Ana.pdf', 'ANA (2).pdf']);
});

test('o (2) gerado não colide com um nome que já era (2)', () => {
  assert.deepEqual(nomesSemRepetir(['a (2).pdf', 'a.pdf', 'a.pdf']), ['a (2).pdf', 'a.pdf', 'a (3).pdf']);
});
