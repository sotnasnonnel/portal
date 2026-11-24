import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLATAFORMAS, DESTINOS, relatoriosDe, linhaDoCabecalho, numeroDeColunas, adivinharColunas, casarComMensal,
} from './importacao.js';

test('plataformas e destinos por área', () => {
  assert.deepEqual(PLATAFORMAS.combustivel, ['Ticket Log', 'Cartão combustível (outro)', 'Locadora', 'Outra']);
  assert.deepEqual(DESTINOS.combustivel.map((d) => [d.campo, d.agg]), [['recarga_mes', 'soma'], ['saldo_remanescente', 'soma']]);
  assert.deepEqual(DESTINOS.quilometragem.map((d) => [d.campo, d.agg]), [['km_atual', 'max'], ['km_rodado_inf', 'soma']]);
});

test('cabeçalho: primeira linha com 3 ou mais células preenchidas', () => {
  const linhas = [
    ['Relatório Ticket Log'],
    ['Período', '01/03/2026 a 31/03/2026', ''],
    [],
    ['Placa', 'Condutor', 'Valor (R$)', 'Litros'],
    ['ABC1D23', 'Fulano', 100, 20],
  ];
  assert.equal(linhaDoCabecalho(linhas), 3);
});

test('cabeçalho: espaços não contam e, sem nenhuma linha boa, fica a 0', () => {
  assert.equal(linhaDoCabecalho([[' ', 'a', 'b'], ['x', 'y', 'z']]), 1);
  assert.equal(linhaDoCabecalho([['a'], ['b', 'c']]), 0);
  assert.equal(linhaDoCabecalho([]), 0);
});

test('cabeçalho: só procura nas 20 primeiras linhas', () => {
  const linhas = Array.from({ length: 25 }, () => ['só uma']);
  linhas[21] = ['a', 'b', 'c'];
  assert.equal(linhaDoCabecalho(linhas), 0);
});

test('número de colunas: a linha mais longa', () => {
  assert.equal(numeroDeColunas([['a'], ['a', 'b', 'c'], []]), 3);
  assert.equal(numeroDeColunas([]), 1);
});

test('adivinha placa pela contagem e valor pela ordem das palavras (combustível)', () => {
  const cab = ['Cartão', 'Total geral', 'Identificação', 'Valor (R$)'];
  const corpo = [
    ['1234', 10, 'ABC-1D23', 50],
    ['5678', 20, 'XYZ 9876', 60],
    ['ABC1D23', 30, 'QWE1A11', 70],
  ];
  // "valor" vem antes de "total" na lista, então ganha mesmo estando mais à direita.
  assert.deepEqual(adivinharColunas(cab, corpo, 'combustivel'), { colPlaca: 2, colValor: 3 });
});

test('adivinha valor de quilometragem sem pegar a coluna da placa', () => {
  const cab = ['Km placa', 'Distância percorrida', 'Hodômetro final'];
  const corpo = [['ABC1D23', 100, 50000], ['DEF4G56', 200, 60000]];
  assert.deepEqual(adivinharColunas(cab, corpo, 'quilometragem'), { colPlaca: 0, colValor: 2 });
  // Sem hodômetro, a distância; "km" sozinho só no fim da lista.
  assert.deepEqual(adivinharColunas(['Placa', 'KM', 'Distancia'], corpo, 'quilometragem'), { colPlaca: 0, colValor: 2 });
});

test('sem placa nem palavra-chave, -1', () => {
  assert.deepEqual(adivinharColunas(['a', 'b'], [['x', 1]], 'combustivel'), { colPlaca: -1, colValor: -1 });
});

const MENSAL = [
  { id: 1, competencia: '2026-03', placa: 'ABC1D23', recarga_mes: 10, km_atual: 1000 },
  { id: 2, competencia: '2026-03', placa: 'DEF4G56' },
  { id: 3, competencia: '2026-02', placa: 'GHI7J89' },
];

test('soma por placa, arredonda em 2 casas e casa com a competência', () => {
  const corpo = [
    ['abc-1d23', '10,10'],
    ['ABC1D23', 'R$ 20,21'],
    ['DEF4G56', 5],
    ['', 99],
    ['GHI7J89', 'sem valor'],
  ];
  const r = casarComMensal(corpo, 0, 1, 'soma', '2026-03', MENSAL);
  assert.deepEqual(r.itens.map((x) => [x.placa, x.valor, x.mensal?.id ?? null]), [
    ['ABC1D23', 30.31, 1],
    ['DEF4G56', 5, 2],
  ]);
  assert.equal(r.casados, 2);
  assert.equal(r.semLancamento, 0);
});

test('maior valor por placa (hodômetro)', () => {
  const corpo = [['ABC1D23', 1500], ['ABC1D23', 1800], ['ABC1D23', '1.200']];
  const r = casarComMensal(corpo, 0, 1, 'max', '2026-03', MENSAL);
  assert.deepEqual(r.itens.map((x) => [x.placa, x.valor]), [['ABC1D23', 1800]]);
});

test('placa sem lançamento no mês fica com mensal null e entra na contagem', () => {
  // GHI7J89 tem lançamento só em fevereiro.
  const corpo = [['GHI7J89', 10], ['ZZZ9Z99', 1], ['ABC1D23', 2]];
  const r = casarComMensal(corpo, 0, 1, 'soma', '2026-03', MENSAL);
  assert.deepEqual(r.itens.map((x) => [x.placa, x.mensal?.id ?? null]), [['ABC1D23', 1], ['GHI7J89', null], ['ZZZ9Z99', null]]);
  assert.equal(r.casados, 1);
  assert.equal(r.semLancamento, 2);
});

test('coluna não escolhida devolve vazio', () => {
  assert.deepEqual(casarComMensal([['ABC1D23', 1]], -1, 1, 'soma', '2026-03', MENSAL), { itens: [], casados: 0, semLancamento: 0 });
  assert.deepEqual(casarComMensal([['ABC1D23', 1]], 0, -1, 'soma', '2026-03', MENSAL).itens, []);
});

test('relatórios: só da área e competência, com arquivo, do mais recente ao mais antigo', () => {
  const arquivos = [
    { id: 'a', area: 'combustivel', competencia: '2026-03', arquivo: { path: 'p/a', enviado_em: '2026-03-02T10:00:00Z' } },
    { id: 'b', area: 'combustivel', competencia: '2026-03', arquivo: { path: 'p/b', enviado_em: '2026-03-05T10:00:00Z' } },
    { id: 'c', area: 'quilometragem', competencia: '2026-03', arquivo: { path: 'p/c' } },
    { id: 'd', area: 'combustivel', competencia: '2026-03', arquivo: null },
    { id: 'e', area: 'combustivel', competencia: '2026-02', arquivo: { path: 'p/e' } },
  ];
  assert.deepEqual(relatoriosDe(arquivos, 'combustivel', '2026-03').map((a) => a.id), ['b', 'a']);
  assert.deepEqual(relatoriosDe(arquivos, 'combustivel').map((a) => a.id).sort(), ['a', 'b', 'e']);
});
