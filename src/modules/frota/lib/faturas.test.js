import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FAT_STATUS, FAT_TIPOS, FILTROS_FATURAS, agendaDePagamentos, autoPreencher, dadosDoVeiculo, difRelevante,
  dueDateFor, faixasDeVencimento, fatAberta, fatDif, fatUrgente, fatVenc, fatVencida, filtrarFaturas,
  gerarFaturasPrevistas, ordenarFaturas, prepararFatura, previstoDe, resumoFaturas, veiculosParaFatura,
} from './faturas.js';
import { SCHEMAS, valoresDoForm } from './schemas.js';
import { COLS_FAT, REPORTS, repData } from './relatorios.js';
import { todayISO } from './regras.js';

const emDias = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmt = (v) => v.toFixed(2).replace('.', ',');

const dados = {
  veiculos: [
    { id: 'v1', placa: 'AAA1A11', status: 'Ativo', modelo: 'ONIX', locadora: 'Movida', contrato: 'C1', condutor: 'Ana', ct: 'CT01', custo_resp: 'PHD', custo_mensal: 2000, gps_valor: 80, dia_vencimento_fatura: 31 },
    { id: 'v2', placa: 'BBB2B22', status: 'Inativo', locadora: 'Versa', custo_mensal: 1500 },
    { id: 'v3', placa: null, status: 'Ativo', condutor: 'Reserva' },
    { id: 'v4', placa: 'AAA0A00', status: 'Ativo', locadora: 'Localiza' },
  ],
  mensal: [
    { competencia: '2026-10', placa: 'AAA1A11', custo_locacao: 2100, gps_valor: 90, multas: 300, avarias: null, frete: 50, condutor: 'Bia', ct: '' },
  ],
  faturas: [],
};

test('listas do protótipo e esquema do formulário', () => {
  assert.deepEqual(FAT_STATUS, ['Prevista', 'Aguardando conferência', 'Conferida', 'Divergência', 'Paga', 'Cancelada']);
  assert.equal(FAT_TIPOS.length, 7);
  const req = SCHEMAS.faturas.filter((f) => f.req).map((f) => f.k);
  assert.deepEqual(req, ['placa', 'competencia', 'tipo', 'vencimento', 'valor', 'status']);
  // Conferido por/em são do banco, não do formulário.
  assert.ok(!SCHEMAS.faturas.some((f) => f.k && f.k.startsWith('conferido')));
});

test('situação do vencimento', () => {
  assert.equal(fatVenc({ status: 'Paga', data_pagamento: '2026-11-03' }).label, 'Paga em 03/11/2026');
  assert.equal(fatVenc({ status: 'Paga' }).label, 'Paga');
  assert.equal(fatVenc({ status: 'Cancelada', vencimento: emDias(-30) }).lvl, 0);
  assert.equal(fatVenc({ status: 'Conferida' }).label, 'Sem vencimento');
  // Escala da v3: 3 vencida, 2 até 2 dias, 1 de 3 a 7 dias.
  assert.deepEqual(fatVenc({ status: 'Conferida', vencimento: emDias(-3) }), { tone: 'crit', label: 'Vencida há 3 d', lvl: 3, d: -3 });
  assert.deepEqual(fatVenc({ status: 'Aguardando conferência', vencimento: todayISO() }), { tone: 'crit', label: 'Vence hoje', lvl: 2, d: 0 });
  assert.equal(fatVenc({ vencimento: emDias(1) }).label, 'Vence amanhã');
  assert.equal(fatVenc({ vencimento: emDias(2) }).lvl, 2);
  assert.deepEqual(fatVenc({ vencimento: emDias(3) }), { tone: 'warn', label: 'Vence em 3 dias', lvl: 1, d: 3 });
  assert.equal(fatVenc({ vencimento: emDias(7) }).lvl, 1);
  assert.equal(fatVenc({ vencimento: emDias(8) }).lvl, 0);
  assert.equal(fatVencida({ status: 'Divergência', vencimento: emDias(-1) }), true);
  assert.equal(fatVencida({ status: 'Divergência', vencimento: todayISO() }), false);
  assert.equal(fatVencida({ status: 'Paga', vencimento: emDias(-1) }), false);
  assert.equal(fatUrgente({ status: 'Conferida', vencimento: emDias(2) }), true);
  assert.equal(fatUrgente({ status: 'Conferida', vencimento: emDias(3) }), false);
  assert.equal(fatAberta({ status: 'Divergência' }), true);
});

test('previsto: mensal da competência vence o cadastro; tipos sem referência dão null', () => {
  assert.equal(previstoDe('AAA1A11', '2026-10', 'Locação mensal', dados), 2100);
  assert.equal(previstoDe('AAA1A11', '2026-09', 'Locação mensal', dados), 2000);
  assert.equal(previstoDe('AAA1A11', '2026-10', 'GPS / telemetria', dados), 90);
  assert.equal(previstoDe('AAA1A11', '2026-09', 'GPS / telemetria', dados), 80);
  assert.equal(previstoDe('AAA1A11', '2026-10', 'Multa', dados), 300);
  assert.equal(previstoDe('AAA1A11', '2026-09', 'Multa', dados), null);
  assert.equal(previstoDe('AAA1A11', '2026-10', 'Avaria', dados), null);
  assert.equal(previstoDe('AAA1A11', '2026-10', 'Frete', dados), 50);
  assert.equal(previstoDe('AAA1A11', '2026-10', 'Km excedente', dados), null);
  assert.equal(previstoDe('', '2026-10', 'Locação mensal', dados), null);
  assert.equal(previstoDe('AAA1A11', '2026-10', '', dados), 2100);
});

test('diferença em centavos e o limite de destaque', () => {
  assert.equal(fatDif({ valor: 2100.1, valor_previsto: 2000 }), 100.1);
  assert.equal(fatDif({ valor: 0.3, valor_previsto: 0.1 }), 0.2);
  assert.equal(fatDif({ valor: 100 }), null);
  assert.equal(fatDif({ status: 'Prevista', valor: 2100, valor_previsto: 2000 }), null, 'previsão não tem divergência');
  assert.equal(difRelevante(0.5), false);
  assert.equal(difRelevante(-0.51), true);
  assert.equal(difRelevante(null), false);
});

test('herança do veículo: campo do mensal preenchido vence, vazio cai no cadastro', () => {
  assert.deepEqual(dadosDoVeiculo('AAA1A11', '2026-10', dados), {
    locadora: 'Movida', contrato: 'C1', condutor: 'Bia', ct: 'CT01', custo_resp: 'PHD',
  });
  assert.equal(dadosDoVeiculo('AAA1A11', '2026-09', dados).condutor, 'Ana');
  assert.equal(dadosDoVeiculo('ZZZ9Z99', '2026-10', dados), null);
});

test('só veículo ativo com placa aceita fatura, em ordem de placa', () => {
  assert.deepEqual(veiculosParaFatura(dados.veiculos).map((v) => v.placa), ['AAA0A00', 'AAA1A11']);
});

test('autopreenchimento não apaga previsto digitado à mão', () => {
  const base = { placa: '', competencia: '2026-10', tipo: 'Locação mensal', valor_previsto: '' };
  let r = autoPreencher({ ...base, placa: 'AAA1A11' }, 'placa', dados, '', fmt);
  assert.equal(r.textos.valor_previsto, '2100,00');
  assert.equal(r.textos.condutor, 'Bia');
  // Mudou o tipo: a sugestão anterior é trocada.
  r = autoPreencher({ ...r.textos, tipo: 'GPS / telemetria' }, 'tipo', dados, r.sugestao, fmt);
  assert.equal(r.textos.valor_previsto, '90,00');
  // Valor digitado à mão fica.
  r = autoPreencher({ ...r.textos, valor_previsto: '95,00', tipo: 'Locação mensal' }, 'tipo', dados, r.sugestao, fmt);
  assert.equal(r.textos.valor_previsto, '95,00');
  // Sem referência para o tipo, a sugestão some.
  r = autoPreencher({ ...base, placa: 'AAA1A11', tipo: 'Km excedente' }, 'placa', dados, '', fmt);
  assert.equal(r.textos.valor_previsto, '');
  // Outro campo não mexe em nada.
  const t = { ...base, valor: '10' };
  assert.equal(autoPreencher(t, 'valor', dados, 'x', fmt).textos, t);
});

test('vencimento sai do dia do contrato e não apaga data digitada à mão', () => {
  assert.equal(dueDateFor('2026-02', 31), '2026-02-28');
  assert.equal(dueDateFor('2028-02', 31), '2028-02-29');
  assert.equal(dueDateFor('2026-03', 5), '2026-03-05');
  assert.equal(dueDateFor('2026-03', null), '');
  const base = { placa: '', competencia: '2026-02', tipo: 'Locação mensal', valor_previsto: '', vencimento: '' };
  let r = autoPreencher({ ...base, placa: 'AAA1A11' }, 'placa', dados, '', fmt);
  assert.equal(r.textos.vencimento, '2026-02-28');
  r = autoPreencher({ ...r.textos, competencia: '2026-03' }, 'competencia', dados, r.sugestao, fmt);
  assert.equal(r.textos.vencimento, '2026-03-31');
  r = autoPreencher({ ...r.textos, vencimento: '2026-03-20', competencia: '2026-04' }, 'competencia', dados, r.sugestao, fmt);
  assert.equal(r.textos.vencimento, '2026-03-20', 'data digitada fica');
  // Veículo sem dia de vencimento não mexe.
  r = autoPreencher({ ...base, placa: 'AAA0A00' }, 'placa', dados, '', fmt);
  assert.equal(r.textos.vencimento, '');
});

test('gerar faturas previstas: só ativo com dia de vencimento e sem locação vencendo no mês', () => {
  const g = gerarFaturasPrevistas('2026-10', dados);
  assert.equal(g.todo.length, 1);
  assert.deepEqual(
    { ...g.todo[0], obs: undefined },
    {
      placa: 'AAA1A11', competencia: '2026-10', tipo: 'Locação mensal', vencimento: '2026-10-31',
      valor: 2100, valor_previsto: 2100, status: 'Prevista', locadora: 'Movida', contrato: 'C1', condutor: 'Ana',
      ct: 'CT01', custo_resp: 'PHD', obs: undefined,
    },
  );
  assert.equal(g.sem, 1, 'AAA0A00 não tem dia de vencimento');
  const comFatura = { ...dados, faturas: [{ placa: 'AAA1A11', tipo: 'Locação mensal', vencimento: '2026-10-31' }] };
  const g2 = gerarFaturasPrevistas('2026-10', comFatura);
  assert.equal(g2.todo.length, 0);
  assert.equal(g2.ja, 1);
  // Sem mensal do mês, o valor sai do cadastro.
  assert.equal(gerarFaturasPrevistas('2026-11', dados).todo[0].valor, 2000);
});

test('preparar: divergência exige observação; completa do veículo; Paga sem data leva hoje', () => {
  assert.equal(prepararFatura({ status: 'Divergência', obs_conferencia: '  ' }, dados).campo, 'obs_conferencia');
  const r = prepararFatura({ placa: 'AAA1A11', status: 'Paga', locadora: 'Outra', condutor: null }, dados);
  assert.equal(r.vals.locadora, 'Outra');
  assert.equal(r.vals.condutor, 'Ana');
  assert.equal(r.vals.contrato, 'C1');
  assert.equal(r.vals.data_pagamento, todayISO());
  assert.equal(prepararFatura({ status: 'Paga', data_pagamento: '2026-11-01' }, dados).vals.data_pagamento, '2026-11-01');
  assert.equal(prepararFatura({ status: 'Divergência', obs_conferencia: 'valor errado' }, dados).erro, undefined);
  // Prevista que recebeu número ou documento vai para a conferência.
  assert.equal(prepararFatura({ status: 'Prevista', numero_fatura: '9' }, dados).vals.status, 'Aguardando conferência');
  assert.equal(prepararFatura({ status: 'Prevista', anexos: [{ path: 'x' }] }, dados).vals.status, 'Aguardando conferência');
  assert.equal(prepararFatura({ status: 'Prevista', anexos: [] }, dados).vals.status, 'Prevista');
});

test('o formulário grava os campos da tabela, valor em número', () => {
  const v = valoresDoForm('faturas', { placa: 'AAA1A11', competencia: '2026-10', tipo: 'Locação mensal', valor: '2.100,50', valor_previsto: '', status: 'Conferida' });
  assert.equal(v.valor, 2100.5);
  assert.equal(v.valor_previsto, null);
  assert.equal(v.status, 'Conferida');
  assert.ok(!('anexos' in v));
});

const lista = [
  { id: 1, placa: 'AAA1A11', competencia: '2026-10', status: 'Aguardando conferência', vencimento: emDias(3), valor: 100, locadora: 'Movida', numero_fatura: '555' },
  { id: 2, placa: 'AAA1A11', competencia: '2026-09', status: 'Paga', vencimento: emDias(-40), valor: 200, locadora: 'Movida' },
  { id: 3, placa: 'AAA0A00', competencia: '2026-10', status: 'Divergência', vencimento: emDias(-2), valor: 300, locadora: 'Localiza', obs_conferencia: 'boleto errado' },
  { id: 4, placa: 'AAA0A00', competencia: '2026-10', status: 'Conferida', vencimento: null, valor: 50, locadora: 'Localiza' },
  { id: 5, placa: 'AAA1A11', competencia: '2026-08', status: 'Cancelada', vencimento: emDias(-70), valor: 10, locadora: 'Movida' },
];
const ids = (rs) => rs.map((r) => r.id);
// Sem mês, para os filtros abaixo valerem sobre a lista inteira.
const fl = (p) => ids(filtrarFaturas(lista, { ...FILTROS_FATURAS, mes: '', ...p }));

test('filtros da tela', () => {
  assert.deepEqual(fl({}), [1, 2, 3, 4, 5]);
  assert.deepEqual(fl({ mes: '2026-10', base: 'ref' }), [1, 3, 4]);
  assert.deepEqual(fl({ mes: emDias(3).slice(0, 7), base: 'venc' }).includes(1), true);
  assert.deepEqual(fl({ mes: '2026-10', base: 'venc' }).includes(4), false, 'sem vencimento fica fora do mês');
  assert.deepEqual(fl({ status: 'Paga' }), [2]);
  assert.deepEqual(fl({ locadora: 'Localiza' }), [3, 4]);
  assert.deepEqual(fl({ placa: 'AAA1A11' }), [1, 2, 5]);
  assert.deepEqual(fl({ venc: 'vencidas' }), [3]);
  assert.deepEqual(fl({ venc: '7d' }), [1]);
  assert.deepEqual(fl({ venc: '2d' }), []);
  assert.deepEqual(fl({ venc: 'sem' }), [4]);
  assert.deepEqual(fl({ de: emDias(-3), ate: emDias(3) }), [1, 3]);
  assert.deepEqual(fl({ q: 'boleto' }), [3]);
  assert.deepEqual(fl({ q: '555' }), [1]);
});

test('ordem por vencimento, crescente ou decrescente, sem data no fim', () => {
  assert.deepEqual(ids(ordenarFaturas(lista)), [5, 2, 3, 1, 4]);
  assert.deepEqual(ids(ordenarFaturas(lista, 'desc')), [1, 3, 2, 5, 4]);
});

test('agenda soma as abertas por dia; resumo conta por situação', () => {
  const ag = agendaDePagamentos([...lista, { id: 6, status: 'Conferida', vencimento: emDias(3), valor: 25 }]);
  assert.deepEqual(ag, [{ l: emDias(-2), v: 300 }, { l: emDias(3), v: 125 }]);
  const r = resumoFaturas(lista);
  assert.deepEqual(ids(r.aguardando), [1]);
  assert.deepEqual(ids(r.divergencia), [3]);
  assert.deepEqual(ids(r.pagas), [2]);
  assert.deepEqual(ids(r.vencidas), [3]);
  assert.deepEqual(ids(r.ate2), []);
  assert.deepEqual(ids(r.ate7), [1]);
  assert.deepEqual(ids(r.semVencimento), [4]);
});

test('faixas do painel: vencidas, até 2 dias, 3 a 7, e o próximo vencimento depois disso', () => {
  const fx = faixasDeVencimento([
    ...lista,
    { id: 7, status: 'Conferida', vencimento: emDias(1) },
    { id: 8, status: 'Conferida', vencimento: emDias(20) },
    { id: 9, status: 'Prevista', vencimento: emDias(15) },
  ]);
  assert.deepEqual(ids(fx.vencidas), [3]);
  assert.deepEqual(ids(fx.ate2), [7]);
  assert.deepEqual(ids(fx.ate7), [1]);
  assert.deepEqual(ids(fx.semVencimento), [4]);
  assert.equal(fx.proxima.id, 9);
});

test('relatório de faturas filtra e agrupa por mês de referência', () => {
  assert.ok(COLS_FAT.some((c) => c.k === 'conferido_por_nome'));
  const ctx = { dados: { ...dados, faturas: lista }, cfg: {} };
  const f = {
    tipo: 'faturas', de: '', ate: '', q: '', grp: 'competencia', sel: { locadora: 'Movida' },
  };
  const { rows, groups } = repData(f, ctx);
  assert.deepEqual(rows.map((x) => x.id).sort(), [1, 2, 5]);
  assert.deepEqual(groups.itens.map((g) => [g.k, g.s[0]]), [['Out/2026', 100], ['Set/2026', 200], ['Ago/2026', 10]]);
  assert.equal(REPORTS.faturas.fonte, 'faturas');
});
