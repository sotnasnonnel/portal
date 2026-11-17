import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAVE_POS_VER_COMO, posicaoPadrao, limitarPosicao, lerPosicao, gravarPosicao,
} from './verComoPosicao.js';

const armazem = (inicial = {}) => {
  const m = new Map(Object.entries(inicial));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), m };
};

test('posição padrão: canto inferior esquerdo', () => {
  assert.deepEqual(posicaoPadrao({ largura: 1280, altura: 800 }, { altura: 34 }), { left: 16, top: 750 });
});

test('limita para o botão continuar alcançável', () => {
  assert.deepEqual(
    limitarPosicao({ left: 5000, top: -40 }, { largura: 1000, altura: 700 }, { largura: 130, altura: 34 }),
    { left: 968, top: 0 },
  );
});

test('grava e lê a posição', () => {
  const a = armazem();
  assert.equal(gravarPosicao(a, { left: 10.4, top: 20.6 }), true);
  assert.equal(a.m.get(CHAVE_POS_VER_COMO), '{"left":10,"top":21}');
  assert.deepEqual(lerPosicao(a), { left: 10, top: 21 });
});

test('valor estragado ou storage bloqueado não quebra', () => {
  assert.equal(lerPosicao(armazem({ [CHAVE_POS_VER_COMO]: '{x' })), null);
  assert.equal(lerPosicao({ getItem: () => { throw new Error('bloqueado'); } }), null);
  assert.equal(gravarPosicao({ setItem: () => { throw new Error('cheio'); } }, { left: 1, top: 1 }), false);
});
