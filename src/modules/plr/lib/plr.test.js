import test from 'node:test';
import assert from 'node:assert/strict';
import {
  percentualDaMeta, aderencia, contribuicao, situacao, resumoSetor,
  formatarValor, formatarPct, paraCampo, deCampo, problemasDaEdicao,
} from './plr.js';

const ind = (meta, resultado, peso, regra = 'proporcional', unidade = 'percentual') =>
  ({ meta, resultado, peso, regra, unidade });

const proximo = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('proporcional: faixas da planilha', () => {
  assert.equal(aderencia(ind(1, 1.2, 0.3)), 1, 'acima da meta tem teto em 100%');
  proximo(aderencia(ind(0.95, 0.9489, 0.2)), 0.9988421);   // PMO, governança
  assert.equal(aderencia(ind(1, 0.94, 0.2)), 0.5);
  assert.equal(aderencia(ind(1, 0.9, 0.2)), 0.5);
  assert.equal(aderencia(ind(1, 0.8999, 0.2)), 0);
});

test('proporcional: o limite de 95% não cai na faixa de baixo por ponto flutuante', () => {
  // 0,9025 / 0,95 é 0,9499999999 em ponto flutuante.
  assert.equal(aderencia(ind(0.95, 0.9025, 1)), 0.95);
});

test('teto: até a meta vale tudo, acima zera', () => {
  assert.equal(aderencia(ind(1, 1.004, 0.3, 'teto')), 0, 'custo 0,4% acima do orçado');
  assert.equal(aderencia(ind(1, 1, 0.3, 'teto')), 1);
  assert.equal(aderencia(ind(30, 23.7, 0.3, 'teto', 'dias')), 1, 'lead time abaixo do prazo');
});

test('sem resultado não é zero: fica pendente e não entra no total', () => {
  const pend = ind(0.9, null, 0.4);
  assert.equal(percentualDaMeta(pend), null);
  assert.equal(aderencia(pend), null);
  assert.equal(contribuicao(pend), null);
  assert.equal(situacao(pend), 'pendente');
  const r = resumoSetor([pend, ind(1, 1, 0.6, 'teto')]);
  proximo(r.total, 0.6);
  assert.equal(r.pendentes, 1);
});

test('situação da célula', () => {
  assert.equal(situacao(ind(1, 1, 1)), 'ok');
  assert.equal(situacao(ind(1, 0.92, 1)), 'parcial');
  assert.equal(situacao(ind(1, 0.5, 1)), 'zero');
});

// Os números da aba SETORES (YTD Julho), para conferir que a tela dá o mesmo
// Total que a planilha mostra.
const OPERACAO_LEONARDO = [
  ind(9.9, 12.24, 0.3, 'proporcional', 'reais_mi'),
  ind(0.3037, 0.3862, 0.3),
  ind(0.092, 0.0918, 0.2),
  ind(0.9, 0.7619, 0.15),
  ind(0.5, 0.6, 0.05),
];
const RH = [
  ind(0.9, 0.9, 0.2),
  ind(0.8, 0, 0.1),
  ind(1, 1.004, 0.3, 'teto'),
  ind(0.018, 0.016, 0.1, 'teto'),
  ind(30, 23.7, 0.3, 'teto', 'dias'),
];
const PMO = [
  ind(0.95, 0.9489, 0.2),
  ind(7, 7, 0.3, 'proporcional', 'numero'),
  ind(0.5, 0.4, 0.2),
  ind(1, 0.9019, 0.3, 'teto'),
];
const COMERCIAL = [
  ind(0.15, 0.063, 0.15),
  ind(9.49, 5.19, 0.2, 'proporcional', 'reais_mi'),
  ind(11.99, 6.41, 0.2, 'proporcional', 'reais_mi'),
  ind(8.16, 6.44, 0.15, 'proporcional', 'reais_mi'),
  ind(1, 1.01, 0.15, 'teto'),
];

test('total do setor bate com a planilha', () => {
  proximo(resumoSetor(OPERACAO_LEONARDO).total, 0.8495652);
  proximo(resumoSetor(RH).total, 0.6);
  // Na planilha, a coluna visível (O) soma as quatro linhas do PMO: 79,98%.
  proximo(resumoSetor(PMO).total, 0.7997684);
});

test('pesos: avisa quando não fecham 100%', () => {
  assert.equal(resumoSetor(RH).pesosFecham, true);
  const com = resumoSetor(COMERCIAL);
  assert.equal(com.pesosFecham, false);
  proximo(com.somaPesos, 0.85);
});

test('formatação', () => {
  assert.equal(formatarValor(0.9, 'percentual'), '90%');
  assert.equal(formatarValor(0.0918, 'percentual'), '9,18%');
  assert.equal(formatarValor(9.49, 'reais_mi'), 'R$ 9,49 mi');
  assert.equal(formatarValor(23.7, 'dias'), '23,7 dias');
  assert.equal(formatarValor(1, 'dias'), '1 dia');
  assert.equal(formatarValor(4.7, 'numero'), '4,7');
  assert.equal(formatarValor(null, 'numero'), '—');
  assert.equal(formatarPct(0.8495652), '84,96%');
  assert.equal(formatarPct(0.7997684), '79,98%');
  assert.equal(formatarPct(0.3, 0), '30%');
});

test('edição: aponta cada problema pela linha', () => {
  const ok = { nome: 'Faturamento', unidade: 'reais_mi', meta: '9,9', resultado: '', peso: '30' };
  assert.deepEqual(problemasDaEdicao([ok]), []);
  const ruins = problemasDaEdicao([
    ok,
    { nome: ' ', unidade: 'percentual', meta: '0', resultado: 'x', peso: '120' },
  ]);
  assert.equal(ruins.length, 4);
  assert.ok(ruins.every((p) => p.startsWith('Linha 2')));
});

test('campos: ida e volta na unidade de quem digita', () => {
  assert.equal(paraCampo(0.9489, 'percentual'), '94,89');
  assert.equal(paraCampo(9.49, 'reais_mi'), '9,49');
  assert.equal(paraCampo(null, 'dias'), '');
  assert.equal(deCampo('94,89', 'percentual'), 0.9489);
  assert.equal(deCampo('94.89%', 'percentual'), 0.9489);
  assert.equal(deCampo('1.234,5', 'numero'), 1234.5);
  assert.equal(deCampo('', 'numero'), null);
  assert.ok(Number.isNaN(deCampo('abc', 'numero')));
  assert.ok(Number.isNaN(deCampo('1,2,3', 'numero')));
});
