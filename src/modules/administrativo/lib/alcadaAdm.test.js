import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SERVICOS_COM_ALCADA, alcadaDoServico, valorParaAlcada, decidirAprovacao, cadeiaDoFluxo,
} from './alcadaAdm.js';

test('só os três serviços com gasto entram na alçada', () => {
  assert.deepEqual(Object.keys(SERVICOS_COM_ALCADA).sort(), [
    'compra/solicitacao-compra',
    'frota/recarga-ticket-log',
    'viagem-hospedagem/locacao-imovel',
  ]);
  assert.equal(alcadaDoServico('uber', 'viagem-uber'), null);
});

test('serviço com valor usa alçada, mesmo sem exigir aprovação no cadastro', () => {
  const d = decidirAprovacao({
    classe: 'compra', servico: 'solicitacao-compra',
    campos: { valor_base: 12400 }, exigeAprovacao: false,
  });
  assert.equal(d.modo, 'alcada');
  assert.equal(d.valor, 12400);
  assert.equal(d.tabela, 'compras');
});

// O erro que uma alçada existe para evitar: sem valor, a faixa mais baixa
// seria escolhida por omissão.
test('serviço de gasto sem valor não passa — bloqueia em vez de cair na faixa mais baixa', () => {
  for (const vazio of [undefined, null, '', 'abc']) {
    const d = decidirAprovacao({
      classe: 'compra', servico: 'solicitacao-compra', campos: { valor_base: vazio },
    });
    assert.equal(d.modo, 'alcada');
    assert.match(d.erro, /valor base/i);
    assert.equal(d.valor, undefined);
  }
});

test('valor zero é valor: enquadra na primeira faixa, não bloqueia', () => {
  const d = decidirAprovacao({ classe: 'frota', servico: 'recarga-ticket-log', campos: { valor: 0 } });
  assert.equal(d.valor, 0);
  assert.equal(d.erro, undefined);
});

test('serviço sem gasto segue o cadastro: fluxo quando exige, nada quando não', () => {
  const base = { classe: 'uber', servico: 'viagem-uber', campos: {} };
  assert.equal(decidirAprovacao({ ...base, exigeAprovacao: true }).modo, 'fluxo');
  assert.equal(decidirAprovacao({ ...base, exigeAprovacao: false }).modo, 'nenhum');
});

test('valorParaAlcada aceita número em texto e recusa lixo', () => {
  const def = SERVICOS_COM_ALCADA['compra/solicitacao-compra'];
  assert.equal(valorParaAlcada({ valor_base: '1500' }, def), 1500);
  assert.equal(valorParaAlcada({ valor_base: 'mil e quinhentos' }, def), null);
  assert.equal(valorParaAlcada({}, def), null);
});

// A cadeia da classe manda; o geral só cobre quem não tem regra própria.
test('cadeiaDoFluxo: classe tem precedência sobre o geral', () => {
  const fluxos = [
    { classe: '', aprovadores: ['geral1'] },
    { classe: 'compra', aprovadores: ['compra1', 'compra2'] },
  ];
  assert.deepEqual(cadeiaDoFluxo(fluxos, 'compra'), ['compra1', 'compra2']);
  assert.deepEqual(cadeiaDoFluxo(fluxos, 'frota'), ['geral1']);
  assert.deepEqual(cadeiaDoFluxo([], 'frota'), []);
});

// Cadeia vazia cadastrada de propósito não é o mesmo que "não cadastrado":
// significa "esta classe não passa por ninguém".
test('cadeia vazia da classe não cai de volta no geral', () => {
  const fluxos = [{ classe: '', aprovadores: ['geral1'] }, { classe: 'frota', aprovadores: [] }];
  assert.deepEqual(cadeiaDoFluxo(fluxos, 'frota'), []);
});
