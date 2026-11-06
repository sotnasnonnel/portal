import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FAT_STATUS, FAT_TIPOS, FILTROS_FATURAS, agendaDePagamentos, autoPreencher, dadosDoVeiculo, difRelevante,
  fatAberta, fatDif, fatVenc, fatVencida, filtrarFaturas, ordenarFaturas, prepararFatura, previstoDe,
  resumoFaturas, veiculosParaFatura,
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
    { id: 'v1', placa: 'AAA1A11', status: 'Ativo', modelo: 'ONIX', locadora: 'Movida', contrato: 'C1', condutor: 'Ana', ct: 'CT01', custo_resp: 'PHD', custo_mensal: 2000, gps_valor: 80 },
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
  assert.deepEqual(FAT_STATUS, ['Aguardando conferência', 'Conferida', 'Divergência', 'Paga', 'Cancelada']);
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
  assert.deepEqual(fatVenc({ status: 'Conferida', vencimento: emDias(-3) }), { tone: 'crit', label: 'Vencida há 3 d', lvl: 2 });
  assert.equal(fatVenc({ status: 'Aguardando conferência', vencimento: todayISO() }).label, 'Vence hoje');
  assert.equal(fatVenc({ vencimento: emDias(7) }).lvl, 1);
  assert.equal(fatVenc({ vencimento: emDias(8) }).lvl, 0);
  assert.equal(fatVencida({ status: 'Divergência', vencimento: emDias(-1) }), true);
  assert.equal(fatVencida({ status: 'Paga', vencimento: emDias(-1) }), false);
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

test('preparar: divergência exige observação; completa do veículo; Paga sem data leva hoje', () => {
  assert.equal(prepararFatura({ status: 'Divergência', obs_conferencia: '  ' }, dados).campo, 'obs_conferencia');
  const r = prepararFatura({ placa: 'AAA1A11', status: 'Paga', locadora: 'Outra', condutor: null }, dados);
  assert.equal(r.vals.locadora, 'Outra');
  assert.equal(r.vals.condutor, 'Ana');
  assert.equal(r.vals.contrato, 'C1');
  assert.equal(r.vals.data_pagamento, todayISO());
  assert.equal(prepararFatura({ status: 'Paga', data_pagamento: '2026-11-01' }, dados).vals.data_pagamento, '2026-11-01');
  assert.equal(prepararFatura({ status: 'Divergência', obs_conferencia: 'valor errado' }, dados).erro, undefined);
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
const fl = (p) => ids(filtrarFaturas(lista, { ...FILTROS_FATURAS, ...p }));

test('filtros da tela', () => {
  assert.deepEqual(fl({}), [1, 2, 3, 4, 5]);
  assert.deepEqual(fl({ comp: '2026-10' }), [1, 3, 4]);
  assert.deepEqual(fl({ status: 'Paga' }), [2]);
  assert.deepEqual(fl({ locadora: 'Localiza' }), [3, 4]);
  assert.deepEqual(fl({ placa: 'AAA1A11' }), [1, 2, 5]);
  assert.deepEqual(fl({ venc: 'vencidas' }), [3]);
  assert.deepEqual(fl({ venc: '7d' }), [1]);
  assert.deepEqual(fl({ venc: 'sem' }), [4]);
  assert.deepEqual(fl({ de: emDias(-3), ate: emDias(3) }), [1, 3]);
  assert.deepEqual(fl({ mesVenc: emDias(3).slice(0, 7) }).includes(1), true);
  assert.deepEqual(fl({ q: 'boleto' }), [3]);
  assert.deepEqual(fl({ q: '555' }), [1]);
});

test('ordem: em aberto por vencimento (sem data no fim), depois fechadas da mais recente', () => {
  assert.deepEqual(ids(ordenarFaturas(lista)), [3, 1, 4, 2, 5]);
});

test('agenda soma as abertas por dia; resumo conta por situação', () => {
  const ag = agendaDePagamentos([...lista, { id: 6, status: 'Conferida', vencimento: emDias(3), valor: 25 }]);
  assert.deepEqual(ag, [{ l: emDias(-2), v: 300 }, { l: emDias(3), v: 125 }]);
  const r = resumoFaturas(lista);
  assert.deepEqual(ids(r.aguardando), [1]);
  assert.deepEqual(ids(r.divergencia), [3]);
  assert.deepEqual(ids(r.pagas), [2]);
  assert.deepEqual(ids(r.vencidas), [3]);
  assert.deepEqual(ids(r.proximas), [1]);
  assert.deepEqual(ids(r.semVencimento), [4]);
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
