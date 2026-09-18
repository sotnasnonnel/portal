import test from 'node:test';
import assert from 'node:assert/strict';
import gerador from './gerar_carga_ausencia_programada.cjs';

const { data, normal, dataInicial, montarPeriodos, saldoCorridoConfere, analisar, C } = gerador;

// Linha no layout da planilha (índice 0 = coluna B).
function linha(campos) {
  const r = new Array(23).fill(null);
  Object.entries(campos).forEach(([k, v]) => { r[C[k]] = v; });
  return r;
}

test('serial do Excel vira data sem escorregar de fuso', () => {
  assert.equal(data(46387), '2026-12-31');
  assert.equal(data(45352), '2024-03-01');
  assert.equal(data(''), null);
  assert.equal(data(null), null);
});

test('nome casa sem acento, caixa ou espaço sobrando', () => {
  assert.equal(normal('  Thales Sander Carvalho de Pádua '), 'THALES SANDER CARVALHO DE PADUA');
  assert.equal(normal('MATHEUS AUGUSTO  BRAGA DE MORAIS '), 'MATHEUS AUGUSTO BRAGA DE MORAIS');
});

test('linhas do mesmo nome e ano viram um período; o crédito é o primeiro saldo', () => {
  // Jarbas: 23 → tirou 9 → 14 → tirou 7 → 7 → tirou 5 (ano 2024).
  const base = { nome: 'JARBAS', anoInicio: 2024, inicioPeriodo: 45472, fimPeriodo: 45837, limite: 46202 };
  const ps = montarPeriodos([
    linha({ ...base, saldo: 23, dias: 9, inicio: 46134, fim: 46142 }),
    linha({ ...base, saldo: 14, dias: 7, inicio: 46181 }),
    linha({ ...base, anoInicio: '2024', saldo: 7, dias: 5, inicio: 46190 }),
    linha({ ...base, anoInicio: 2025, saldo: 23, dias: '', inicio: null }),
  ]);
  assert.equal(ps.length, 2);
  const [p] = ps;
  assert.equal(p.credito, 23);
  assert.equal(p.lancamentos.length, 3);
  assert.equal(p.lancamentos[0].fim, data(46142));
  // Sem FIM na planilha, o fim sai da quantidade de dias corridos.
  assert.equal(p.lancamentos[1].fim, data(46181 + 6));
  assert.equal(saldoCorridoConfere(p), true);
  assert.equal(ps[1].lancamentos.length, 0);
});

test('saldo digitado que não fecha é sinalizado', () => {
  const base = { nome: 'ANA', anoInicio: 2025, inicioPeriodo: 45800, fimPeriodo: 46165, limite: 46530 };
  const [p] = montarPeriodos([
    linha({ ...base, saldo: 21, dias: 14, inicio: 46000 }),
    linha({ ...base, saldo: 14 }),
  ]);
  assert.equal(saldoCorridoConfere(p), false);
});

test('análise separa quem não está no portal, quem não tem saldo e o negativo', () => {
  const base = { anoInicio: 2025, inicioPeriodo: 45800, fimPeriodo: 46165, limite: 46530 };
  const ps = montarPeriodos([
    linha({ ...base, nome: 'FORA DO PORTAL', saldo: 21 }),
    linha({ ...base, nome: 'SEM SALDO', saldo: null }),
    linha({ ...base, nome: 'NEGATIVO', saldo: 5, dias: 7, inicio: 46000 }),
    linha({ ...base, nome: 'OK', saldo: 21, dias: 7, inicio: 46000 }),
  ]);
  const a = analisar(ps, new Set(['SEM SALDO', 'NEGATIVO', 'OK']));
  assert.deepEqual(a.semColaborador, ['FORA DO PORTAL']);
  assert.equal(a.semSaldo.length, 1);
  assert.equal(a.negativos.length, 1);
  assert.equal(a.negativos[0].saldoFinal, -2);
  assert.equal(a.validos.length, 2);
});

test('saldo remanescente com data limite antes do fim do período já está liberado', () => {
  // Rodolpho: período 2026/2027 com "12 residual SC", data limite 31/12/2026.
  assert.equal(dataInicial({ inicio: '2026-06-06', fim: '2027-06-06', limite: '2026-12-31' }), '2026-06-06');
  // Regra padrão: usa a partir do fim do período.
  assert.equal(dataInicial({ inicio: '2025-08-20', fim: '2026-08-20', limite: '2027-08-20' }), '2026-08-20');
  // CLT com data limite fixa, mas depois do fim do período: segue a regra padrão.
  assert.equal(dataInicial({ inicio: '2025-03-01', fim: '2026-03-01', limite: '2026-12-31' }), '2026-03-01');
});
