import test from 'node:test';
import assert from 'node:assert/strict';
import {
  media, resumoSatisfacao, NOTAS_POSSIVEIS, faixaDaMedia, posicaoNaEscala, temAvaliacao,
} from './satisfacao.js';

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

// ---- faixa e posição no gráfico ----

test('a faixa muda exatamente nos cortes de 3 e 4', () => {
  assert.equal(faixaDaMedia(2.9), 'baixa');
  assert.equal(faixaDaMedia(3), 'media');
  assert.equal(faixaDaMedia(3.9), 'media');
  assert.equal(faixaDaMedia(4), 'alta');
  assert.equal(faixaDaMedia(5), 'alta');
});

// Serviço sem nota não pode cair na faixa "baixa" — ele não foi mal avaliado,
// ele não foi avaliado.
test('média nula tem faixa própria, não "baixa"', () => {
  assert.equal(faixaDaMedia(null), 'vazia');
  assert.equal(faixaDaMedia(undefined), 'vazia');
});

// A régua vai de 1 a 5: nota 1 encosta no início, nota 3 fica no meio.
test('a posição no trilho respeita a escala de 1 a 5', () => {
  assert.equal(posicaoNaEscala(1), 0);
  assert.equal(posicaoNaEscala(3), 50);
  assert.equal(posicaoNaEscala(5), 100);
  assert.equal(posicaoNaEscala(4), 75);
});

// Valor fora da escala viraria `left` negativo ou acima de 100% — o ponto
// sairia do trilho em vez de encostar na ponta.
test('nota fora da escala fica presa nas pontas', () => {
  assert.equal(posicaoNaEscala(0), 0);
  assert.equal(posicaoNaEscala(9), 100);
  assert.equal(posicaoNaEscala(null), 0);
});

// ---- forma do embed do PostgREST ----
// `chamado_id` tem UNIQUE, então o embed vem como OBJETO. Testar `.length` nele
// dava undefined e todo chamado avaliado passava por não avaliado — travando a
// abertura de chamados justamente para quem tinha avaliado.

test('embed objeto (relação um-para-um) conta como avaliado', () => {
  assert.equal(temAvaliacao({ id: 'abc' }), true);
});

test('embed lista também conta, se a UNIQUE cair um dia', () => {
  assert.equal(temAvaliacao([{ id: 'abc' }]), true);
  assert.equal(temAvaliacao([]), false);
});

test('sem avaliação, nas duas formas de vazio', () => {
  assert.equal(temAvaliacao(null), false);
  assert.equal(temAvaliacao(undefined), false);
});
