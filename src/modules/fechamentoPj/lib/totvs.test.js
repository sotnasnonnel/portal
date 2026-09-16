import test from 'node:test';
import assert from 'node:assert/strict';
import {
  gerarTxt, ratearLiquido, prontoParaTxt, statusFornecedor, datasPadrao, paraCp1252, dadosConferencia, csvPagamento, montarLinhasPagamento,
} from './totvs.js';
import { eventosAnaliticos, folhaAnalitica } from './relatorios.js';
import { TAMANHO_L, TAMANHO_U } from './layoutRm.js';

const linha = (over = {}) => ({
  seq: 1, empresa: 'PHD ASSESSORIA', nome: 'JOSÉ TESTE', razaoSocial: 'JT LTDA', cnpj: '11.222.333/0001-81',
  codigoRm: '0000543', bruto: 12000, liquido: 11583.35, nf: '', documento: '', statusFornecedor: 'PRONTO',
  rateio: [{ codCt: 'AURA-CT02', codigoRm: '1.040.020102', percentual: 100 }], ...over,
});

test('rateio fecha exatamente o líquido, com o resto na última linha', () => {
  const r = ratearLiquido(linha({ liquido: 100, rateio: [
    { codCt: 'A', codigoRm: '1.000.000001', percentual: 33.333333 },
    { codCt: 'B', codigoRm: '1.000.000002', percentual: 33.333333 },
    { codCt: 'C', codigoRm: '1.000.000003', percentual: 33.333334 },
  ] }));
  assert.deepEqual(r.map((x) => x.valor), [33.33, 33.33, 33.34]);
});

test('sem código RM do centro de custo não fica pronto para o TXT', () => {
  assert.equal(prontoParaTxt(linha()), true);
  assert.equal(prontoParaTxt(linha({ rateio: [{ codCt: 'CORP>MKT', codigoRm: null, percentual: 100 }] })), false);
  assert.equal(prontoParaTxt(linha({ codigoRm: '' })), false);
});

test('TXT: posições do layout L/U', () => {
  const r = gerarTxt({ linhas: [linha(), linha({ codigoRm: '' })], competencia: '2026-08-01' });
  assert.equal(r.prontos, 1);
  assert.equal(r.pendentes, 1);
  const [L, U, fim] = r.conteudo.split('\r\n');
  assert.equal(fim, '');
  assert.equal(L.length, TAMANHO_L);
  assert.equal(U.length, TAMANHO_U);
  assert.equal(L.slice(4, 15), '00010000543');
  assert.equal(L.slice(33, 35), '29');
  assert.equal(L.slice(43, 53), 'PJ0826-001');
  assert.equal(L.slice(283, 289), '010926');
  assert.equal(L.slice(289, 295), '280826');
  assert.equal(L.slice(468, 486), '000000000115833500', 'valor do L com 4 casas');
  assert.equal(L.slice(1566, 1572), '080826');
  assert.equal(L.slice(1581, 1584), '@@@');
  assert.equal(L.slice(1589, 1700).trimEnd(), 'Pagamento de servicos - PJ 08/2026 - JOSE TESTE');
  assert.equal(U.slice(0, 17), 'U00011.040.020102');
  assert.equal(U.slice(30, 48), '000000000001158335', 'valor do U com 2 casas');
  assert.equal(U.slice(303, 315), '002.03.04.13');
});

test('datas padrão viram o ano em dezembro', () => {
  assert.deepEqual(
    [datasPadrao('2026-12-01').emissao, datasPadrao('2026-12-01').vencimento],
    ['281226', '010127'],
  );
});

test('cp1252 de verdade', () => {
  assert.deepEqual([...paraCp1252('Ação€')], [0x41, 0xe7, 0xe3, 0x6f, 0x80]);
});

test('status do fornecedor', () => {
  assert.equal(statusFornecedor(null), 'PENDENTE');
  const base = { codigo_rm: '0000001', razao_social: 'X', cnpj: '1' };
  assert.equal(statusFornecedor(base), 'CADASTRO RM');
  assert.equal(statusFornecedor({ ...base, bancos: [{ ativo: true, formaPagamento: 'PIX', favorecidoDoc: '1', pixChave: 'k' }] }), 'PRONTO');
});

test('montarLinhasPagamento usa cadastro congelado de competência fechada e o de-para dos centros', () => {
  const linhas = montarLinhasPagamento({
    envelopes: [
      { id: 'e1', prestador_id: 'p1', bruto: 1000, descontos: 100, cadastro: null, rateio: null },
      { id: 'e2', prestador_id: 'p2', bruto: 500, descontos: 0, cadastro: { nome: 'NOME ANTIGO', cnpj: '9' }, rateio: [{ codCt: 'X', codigoRm: '1.000.000009', percentual: 100 }] },
    ],
    prestadores: [{ id: 'p1', nome: 'BRUNO', cnpj: '1' }, { id: 'p2', nome: 'NOME NOVO', cnpj: '9' }],
    fornecedores: [{ prestador_id: 'p1', codigo_rm: '0000001', razao_social: 'B LTDA', cnpj: '1' }],
    rateios: [{ prestador_id: 'p1', cod_ct: 'CORP>MKT', percentual: 100 }],
    centros: { 'CORP>MKT': '3.000.050100' },
  });
  assert.deepEqual(linhas.map((l) => [l.nome, l.liquido, l.rateio[0].codigoRm]), [['BRUNO', 900, '3.000.050100'], ['NOME ANTIGO', 500, '1.000.000009']]);
});

test('Excel de conferência: 7 abas e L x U sem diferença', () => {
  const d = dadosConferencia({ linhas: [linha()], competencia: '2026-08-01' });
  assert.deepEqual(d.abas.map((a) => a.nome), ['Parametros_RM', 'Fornecedores_RM', 'Entrada_PJ', 'Rateio_PJ', 'Input_TOTVS', 'Pendencias', 'Resumo']);
  const resumo = d.abas.at(-1).linhas;
  assert.equal(resumo.find((r) => r[0] === 'Diferença L x U')[1], 0);
  assert.equal(d.abas[2].linhas[0].at(-1), 'PENDENTE', 'sem NF/documento o status geral fica pendente');
});

test('CSV com BOM e ponto e vírgula', () => {
  const csv = csvPagamento({ linhas: [linha()] });
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.match(csv, /"1.040.020102 100.00%"/);
});

test('Folha Analítica concilia envelope só com totais (carga histórica)', () => {
  const ev = eventosAnaliticos({ bruto: 1000, descontos: 50, eventos: [] });
  assert.deepEqual(ev.map((e) => [e.codigo, e.valor]), [['1000', 1000], ['2100', 50]]);
  const ajuste = eventosAnaliticos({ bruto: 1000, descontos: 0, eventos: [{ codigo: '1000', natureza: 'provento', valor: 900 }] });
  assert.deepEqual(ajuste.map((e) => [e.codigo, e.valor]), [['1000', 900], ['1199', 100]]);
  const f = folhaAnalitica({ envelopes: [{ id: 'e', prestador_id: 'p', bruto: 1000, descontos: 50, eventos: [] }], prestadores: [{ id: 'p', nome: 'X' }] });
  assert.equal(f.totais.liquido, 950);
  assert.equal(f.totalGeral.length, 2);
});
