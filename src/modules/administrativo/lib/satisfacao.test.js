import test from 'node:test';
import assert from 'node:assert/strict';
import { media, resumoSatisfacao, NOTAS_POSSIVEIS } from './satisfacao.js';

const av = (nota, servico = 'a', classe = 'ti') => ({ nota, classe, servico });

// Média de nada não é zero: zero seria "todo mundo odiou".
test('sem avaliação, a média é nula — nunca zero', () => {
  assert.equal(media([]), null);
  const r = resumoSatisfacao([]);
  assert.equal(r.media, null);
  assert.equal(r.total, 0);
});

test('média arredonda para uma casa', () => {
  assert.equal(media([5, 4]), 4.5);
  assert.equal(media([5, 4, 4]), 4.3);
  assert.equal(media([1, 2, 2]), 1.7);
});

test('aceita nota em texto, como vem do banco em alguns drivers', () => {
  assert.equal(resumoSatisfacao([av('5'), av('3')]).media, 4);
});

// Esconder "nenhum 1 estrela" faria a distribuição mentir por omissão.
test('a distribuição traz as cinco notas mesmo com zero', () => {
  const r = resumoSatisfacao([av(5), av(5), av(3)]);
  assert.deepEqual(r.distribuicao.map((d) => d.nota), NOTAS_POSSIVEIS);
  assert.deepEqual(r.distribuicao.map((d) => d.total), [2, 0, 1, 0, 0]);
});

test('percentual da distribuição fecha em cima do total', () => {
  const r = resumoSatisfacao([av(5), av(5), av(4), av(1)]);
  const porNota = Object.fromEntries(r.distribuicao.map((d) => [d.nota, d.pct]));
  assert.equal(porNota[5], 50);
  assert.equal(porNota[4], 25);
  assert.equal(porNota[1], 25);
});

test('agrupa por serviço e calcula a média de cada um', () => {
  const r = resumoSatisfacao([
    av(5, 'impressoras'), av(3, 'impressoras'),
    av(2, 'troca-equipamentos'),
  ]);
  const porNome = Object.fromEntries(r.porServico.map((s) => [s.servico, s]));
  assert.equal(porNome.impressoras.media, 4);
  assert.equal(porNome.impressoras.total, 2);
  assert.equal(porNome['troca-equipamentos'].media, 2);
});

// A lista existe para achar problema: o pior tem de estar em cima.
test('serviços saem do pior para o melhor', () => {
  const r = resumoSatisfacao([av(5, 'bom'), av(1, 'ruim'), av(3, 'medio')]);
  assert.deepEqual(r.porServico.map((s) => s.servico), ['ruim', 'medio', 'bom']);
});

test('empate na média desempata pelo volume', () => {
  const r = resumoSatisfacao([
    av(2, 'poucos'),
    av(2, 'muitos'), av(2, 'muitos'), av(2, 'muitos'),
  ]);
  assert.deepEqual(r.porServico.map((s) => s.servico), ['muitos', 'poucos']);
});

// Mesmo slug em classes diferentes ("outras-demandas") não pode virar um só.
test('serviços homônimos de classes diferentes não se misturam', () => {
  const r = resumoSatisfacao([
    av(5, 'outras-demandas', 'frota'),
    av(1, 'outras-demandas', 'saude-seguranca'),
  ]);
  assert.equal(r.porServico.length, 2);
});
