import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SERVICOS_COM_ALCADA, alcadaDoServico, valorParaAlcada, decidirAprovacao, cadeiaDoFluxo,
  juntarCadeias, papeisForaDaCadeia,
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

// ---- gerente antes da faixa ----

test('juntarCadeias preserva a ordem: gerente primeiro, faixa depois', () => {
  assert.deepEqual(juntarCadeias(['gerente'], ['coo', 'financeiro']),
    ['gerente', 'coo', 'financeiro']);
});

// Na faixa até R$ 2.000 o papel da alçada É o gerente: sem dedução, ele
// receberia duas etapas seguidas do mesmo pedido.
test('quem já está na cadeia não aprova duas vezes', () => {
  assert.deepEqual(juntarCadeias(['gerente'], ['gerente']), ['gerente']);
  assert.deepEqual(juntarCadeias(['a', 'b'], ['b', 'c']), ['a', 'b', 'c']);
});

test('sem gerente, a cadeia é só a da faixa', () => {
  assert.deepEqual(juntarCadeias([], ['ceo']), ['ceo']);
});

test('ids vazios não viram etapa', () => {
  assert.deepEqual(juntarCadeias(['', null, 'a'], [undefined, 'a']), ['a']);
});

// ---- papel que deveria vir da cadeia mas veio da lista fixa ----

const etapa = (papel, origem) => ({ papel, candidatos: [{ id: 'x', nome: 'X', origem }] });

test('papel de cadeia resolvido pela lista fixa é acusado', () => {
  assert.deepEqual(papeisForaDaCadeia([etapa('GERENTE_EXECUTIVO', 'ATRIBUIDO')]),
    ['GERENTE_EXECUTIVO']);
});

test('papel de cadeia achado no organograma passa', () => {
  assert.deepEqual(papeisForaDaCadeia([etapa('GERENTE_EXECUTIVO', 'CADEIA')]), []);
  assert.deepEqual(papeisForaDaCadeia([etapa('GERENTE', 'CADEIA')]), []);
});

// COO, CEO e Gerente Financeiro são cargos únicos da empresa: vir da lista fixa
// é o certo para eles, e bloquear ali travaria todas as faixas altas.
test('papel global não é cobrado da cadeia', () => {
  assert.deepEqual(papeisForaDaCadeia([
    etapa('COO', 'ATRIBUIDO'),
    etapa('GERENTE_FINANCEIRO', 'ATRIBUIDO'),
    etapa('CEO', 'FUNCAO'),
  ]), []);
});

// Papel de grupo traz vários candidatos: basta um vir da cadeia para valer.
test('grupo com ao menos um da cadeia passa', () => {
  assert.deepEqual(papeisForaDaCadeia([{
    papel: 'GERENTE_EXECUTIVO',
    candidatos: [{ id: 'a', origem: 'ATRIBUIDO' }, { id: 'b', origem: 'CADEIA' }],
  }]), []);
});
