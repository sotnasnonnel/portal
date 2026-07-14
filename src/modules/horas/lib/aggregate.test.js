import { test } from 'node:test';
import assert from 'node:assert/strict';
import { somaMs, agruparHoras, serieDiaria } from './aggregate.js';

const H = 3600000;

test('somaMs soma durações ignorando ausentes', () => {
  assert.equal(somaMs([]), 0);
  assert.equal(somaMs([{ duracao: 2 * H }, { duracao: H }]), 3 * H);
  assert.equal(somaMs([{ duracao: H }, {}]), H); // sem duracao conta como 0
});

test('agruparHoras soma por chave e ordena por duração desc', () => {
  const lista = [
    { projeto: 'A', duracao: 1 * H },
    { projeto: 'B', duracao: 3 * H },
    { projeto: 'A', duracao: 1 * H },
  ];
  const r = agruparHoras(lista, (a) => a.projeto);
  assert.deepEqual(r.map((x) => x.name), ['B', 'A']); // B (3h) antes de A (2h)
  assert.equal(r.find((x) => x.name === 'A').ms, 2 * H);
  assert.equal(r.find((x) => x.name === 'B').horas, 3);
});

test('agruparHoras usa "—" para chave vazia', () => {
  const r = agruparHoras([{ duracao: H }], (a) => a.nada);
  assert.equal(r[0].name, '—');
});

test('agruparHoras preserva registros curtos (sem arredondar para zero)', () => {
  // 10s não pode virar 0 horas — o gráfico deixaria de mostrá-lo.
  const r = agruparHoras([{ k: 'x', duracao: 10000 }], (a) => a.k);
  assert.equal(r[0].ms, 10000);
  assert.ok(r[0].horas > 0);
});

test('serieDiaria devolve N dias, o último sendo hoje', () => {
  const agora = new Date(2026, 0, 15, 12, 0, 0).getTime(); // 15/01/2026 meio-dia
  const dia = new Date(2026, 0, 15, 9, 0, 0).getTime();
  const s = serieDiaria([{ inicio: dia, duracao: 2 * H }], 14, agora);
  assert.equal(s.length, 14);
  assert.equal(s[13].ms, 2 * H); // último balde = hoje
  assert.equal(s[0].ms, 0); // 13 dias atrás, sem dados
  // rótulo dd/mm do último dia
  assert.match(s[13].name, /15\/01/);
});
