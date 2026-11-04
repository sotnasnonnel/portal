import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ader, calc, corpFator, efetivo, efetivoBase, indScore, montarDados, setorScore } from './motorHub.ts';

const proximo = (a: number, b: number, msg = '') => assert.ok(Math.abs(a - b) < 1e-9, `${msg} ${a} != ${b}`);

test('réguas do HUB', () => {
  assert.equal(ader('p90', 1, 1.2).ad, 1, 'teto em 100%');
  proximo(ader('p90', 1, 0.97).ad, 0.97);
  assert.equal(ader('p90', 1, 0.94).ad, 0.5);
  assert.equal(ader('p90', 1, 0.89).ad, 0);
  assert.equal(ader('p70', 1, 0.7).ad, 0.5);
  assert.equal(ader('p70', 1, 0.69).ad, 0);
  assert.equal(ader('teto', 1, 1).ad, 1);
  assert.equal(ader('teto', 1, 1.01).ad, 0);
  assert.equal(ader('inv', 30, 20).ad, 1, 'menor é melhor');
  assert.equal(ader('inv', 30, 40).ad, 0);
  assert.equal(ader('p90', null, 1).nd, true);
});

test('o automático vale até alguém editar a linha', () => {
  const l = { fonte: 'x', meta: 1, res: 1, auto: { meta: 2, res: 3 } };
  assert.deepEqual(efetivo(l), { meta: 2, res: 3 });
  assert.deepEqual(efetivo({ ...l, manual: true }), { meta: 1, res: 1 });
});

test('no painel o automático só substitui o YTD', () => {
  const l = { fonte: 'x', auto: { res: 9 }, proj: { meta: 1, res: 1 }, ytd: { meta: 2, res: 2 } };
  assert.deepEqual(efetivoBase(l, 'proj'), { meta: 1, res: 1 });
  assert.deepEqual(efetivoBase(l, 'ytd'), { meta: 2, res: 9 });
});

test('a % do setor é a soma de aderência × peso', () => {
  const s = {
    ind: [
      { meta: 1, res: 1, peso: 0.6, regra: 'p90' },
      { meta: 1, res: 1.2, peso: 0.4, regra: 'teto' },
    ],
  };
  proximo(setorScore(s), 0.6);
  assert.equal(indScore([]), 0);
});

const dados = (premissas = {}) => montarDados(
  [
    {
      chave: 'painel',
      valor: {
        indicadores: [
          { id: 'mol', peso: 0.5, regra: 'p70', trigger: true, proj: { meta: 1, res: 1 }, ytd: { meta: 1, res: 0.6 } },
          { id: 'ind', peso: 0.5, regra: 'p90', individual: true, proj: { meta: 1, res: 1 }, ytd: { meta: 1, res: 0.7 } },
        ],
      },
    },
    { chave: 'setores', valor: { setores: [{ id: 'op', nome: 'Op', ind: [{ meta: 1, res: 0.97, peso: 1, regra: 'p90' }] }] } },
    { chave: 'premissas', valor: premissas },
    { chave: 'variavel', valor: { meses: ['jul', 'ago', 'set'], gatilhoMes: 1, pct: 0.01, tetoTri: 15000, metaCiclo: 3, extraPHD: 5000 } },
  ],
  [],
);

const pessoa = {
  salario: 100, multPlr: 2, multBonus: 1, setores: [], metas: [], bonus: [], indSetor: null, over: null, sup: false, variavel: null,
};

test('fator corporativo usa a linha individual da planilha, e o gatilho o zera', () => {
  const D = dados();
  const proj = corpFator(D, 'proj');
  proximo(proj.pct, 1);
  assert.equal(proj.trig, false);
  const ytd = corpFator(D, 'ytd');
  assert.equal(ytd.trig, true);
  assert.equal(ytd.pct, 0);
  proximo(ytd.mol.ratio, 0.6);
});

test('fator da pessoa troca a linha individual pelas metas dela', () => {
  const D = dados();
  const c = calc(D, { ...pessoa, metas: [{ meta: 1, res: 0, peso: 1, regra: 'p90' }] }, 'proj');
  proximo(c.P.pct, 0.5, 'meio da margem + zero das metas');
  proximo(c.r.plr, 100 * 2 * 0.5);
  const doSetor = calc(D, { ...pessoa, indSetor: 'op' }, 'proj');
  proximo(doSetor.P.pct, 0.5 + 0.5 * 0.97, 'metas = scorecard do setor (97%)');
});

test('bônus: scorecard × múltiplo, e o piso de lucro zera', () => {
  const comBonus = { ...pessoa, bonus: [{ meta: 1, res: 1, peso: 1, regra: 'p90' }] };
  const liberado = calc(dados(), comBonus, 'proj');
  proximo(liberado.r.bon, 100);
  const zerado = calc(dados({ lucroOn: true, lucroPct: 0.7, lucroPiso: 0.8 }), comBonus, 'proj');
  assert.equal(zerado.r.bon, 0);
  assert.equal(zerado.B.block, true);
});

test('bônus pelo over da MC: 3,5% do que passou da meta, até o teto', () => {
  const over = {
    ...pessoa,
    over: { mc: 0, fatMeta: 1, fatRes: 1, teto: 5 },
    bonus: [{ meta: 0.3, res: 0.4, peso: 1, regra: 'p90' }],
  };
  proximo(calc(dados(), over, 'proj').r.bon, 500, 'R$ 100 mil de over paga 3.500, mas o teto é 5 salários = 500');
  const r = calc(dados(), { ...over, salario: 100000 }, 'proj').r;
  proximo(r.bon, 0.1 * 1e6 * 0.035);
});

test('variável: 1% da venda dos meses acima do gatilho, com teto por trimestre', () => {
  const c = calc(dados(), { ...pessoa, variavel: { venda: [1, 0.5, 2] } }, 'proj');
  proximo(c.r.var, 15000, '10 mil + 20 mil, limitado a 15 mil no trimestre');
  proximo(c.r.total, c.r.plr + 15000);
  assert.equal(calc(dados(), pessoa, 'proj').V, null, 'sem variável');
});
