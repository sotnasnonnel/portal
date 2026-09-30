import test from 'node:test';
import assert from 'node:assert/strict';
import { resumoPeriodo, diaComDistribuicao, veResumoHumor, humorPorValor } from './humor.js';

const dia = (total, [a, b, c, d, e]) => ({
  total, muito_mal: a, triste: b, ok: c, feliz: d, muito_feliz: e,
});

test('dia com poucas respostas vem sem distribuição', () => {
  assert.equal(diaComDistribuicao(dia(2, [null, null, null, null, null])), false);
  assert.equal(diaComDistribuicao(dia(3, [0, 1, 1, 1, 0])), true);
});

test('resumo soma só os dias com distribuição, mas conta todas as respostas', () => {
  const r = resumoPeriodo([
    dia(4, [0, 1, 1, 1, 1]),            // soma 2+3+4+5 = 14
    dia(2, [null, null, null, null, null]), // escondido
  ]);
  assert.equal(r.respostas, 6);
  assert.equal(r.contados, 4);
  assert.equal(r.media, 3.5);
  assert.equal(r.pctBem, 50);
  assert.equal(r.pctMal, 25);
});

test('sem nada contável, média e porcentagens são nulas — nunca zero', () => {
  const r = resumoPeriodo([dia(1, [null, null, null, null, null])]);
  assert.equal(r.media, null);
  assert.equal(r.pctBem, null);
  assert.equal(r.respostas, 1);
});

test('só gestão e RH veem o resumo', () => {
  assert.equal(veResumoHumor({ perfil: 'gestor' }), true);
  assert.equal(veResumoHumor({ perfil: 'usuario' }), false);
  assert.equal(veResumoHumor({ perfil: 'usuario', rhDp: true }), true);
  assert.equal(humorPorValor(3).rotulo, 'Ok');
});
