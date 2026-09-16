import test from 'node:test';
import assert from 'node:assert/strict';
import {
  proporcionalidade, aplicarProporcional, totaisEventos, conferir, ajustarPorResolucao, calcularEnvelope,
  validarEncerramento, calcularEncerramento, termoApos, substituirAssunto,
} from './calculo.js';

const CONFIG = {
  base_proporcional: '30_dias', proporcional_admissao: true, proporcional_encerramento: true,
  indenizacao_percentual: 50, bloquear_termo_divergencia: true, tolerancia_bruto: 0.01,
};
const AGO = '2026-08-01';
const ev = (codigo, natureza, valor, over = {}) => ({
  codigo, descricao: codigo === '1000' ? 'VALOR BRUTO CONTRATUAL' : `EVENTO ${codigo}`, natureza, valor, referencia: 0, ...over,
});
const prestador = (over = {}) => ({ id: 'p1', valor_mensal: 9000, data_inicio: '2024-01-10', data_fim: null, beneficios: {}, ...over });

// ---------------------------------------------------------------------------
// Proporcionalidade
// ---------------------------------------------------------------------------

test('mês cheio não aplica proporcional', () => {
  const r = proporcionalidade({ prestador: prestador(), competencia: AGO, config: CONFIG });
  assert.equal(r.aplica, false);
  assert.equal(r.valorCalculado, 9000);
  assert.equal(r.motivo, 'Competência integral');
});

test('admissão no meio do mês, base 30 dias', () => {
  const r = proporcionalidade({ prestador: prestador({ data_inicio: '2026-08-11' }), competencia: AGO, config: CONFIG });
  assert.equal(r.aplica, true);
  assert.equal(r.diasAtivos, 20);
  assert.equal(r.valorCalculado, 6000);
  assert.equal(r.motivo, 'Admissão');
});

test('base 30 dias: dia 31 conta como 30 (entrada no 31 = 1 dia, saída no 31 = mês cheio)', () => {
  const entra31 = proporcionalidade({ prestador: prestador({ data_inicio: '2026-08-31' }), competencia: AGO, config: CONFIG });
  assert.equal(entra31.diasAtivos, 1);
  const sai31 = proporcionalidade({ prestador: prestador({ data_fim: '2026-08-31' }), competencia: AGO, config: CONFIG });
  assert.equal(sai31.diasAtivos, 30);
});

test('base dias corridos usa o tamanho do mês', () => {
  const r = proporcionalidade({
    prestador: prestador({ data_inicio: '2026-02-15' }), competencia: '2026-02-01', config: { ...CONFIG, base_proporcional: 'dias_corridos' },
  });
  assert.equal(r.divisor, 28);
  assert.equal(r.diasAtivos, 14);
  assert.equal(r.valorCalculado, 4500);
});

test('encerramento registrado gera proporcional mesmo com a chave desligada', () => {
  const r = proporcionalidade({
    prestador: prestador(), competencia: AGO, config: { ...CONFIG, proporcional_encerramento: false },
    encerramento: { data_encerramento: '2026-08-15', status: 'programado' },
  });
  assert.equal(r.aplica, true);
  assert.equal(r.diasAtivos, 15);
  const cancelado = proporcionalidade({
    prestador: prestador(), competencia: AGO, config: { ...CONFIG, proporcional_encerramento: false },
    encerramento: { data_encerramento: '2026-08-15', status: 'cancelado' },
  });
  assert.equal(cancelado.aplica, false);
});

test('proporcional é desfeito quando deixa de valer (bug do protótipo)', () => {
  const prop = proporcionalidade({ prestador: prestador({ data_fim: '2026-08-15' }), competencia: AGO, config: CONFIG });
  const proporcional = aplicarProporcional([ev('1000', 'provento', 9000)], prop);
  assert.equal(proporcional[0].valor, 4500);
  assert.match(proporcional[0].descricao, /PROPORCIONAL$/);

  const integral = proporcionalidade({ prestador: prestador(), competencia: AGO, config: CONFIG });
  const volta = aplicarProporcional(proporcional, integral);
  assert.equal(volta[0].valor, 9000);
  assert.equal(volta[0].descricao, 'VALOR BRUTO CONTRATUAL');
});

test('evento forçado não é tocado pelo proporcional', () => {
  const prop = proporcionalidade({ prestador: prestador({ data_inicio: '2026-08-11' }), competencia: AGO, config: CONFIG });
  const r = aplicarProporcional([ev('1000', 'provento', 7777, { forcado: true })], prop);
  assert.equal(r[0].valor, 7777);
});

// ---------------------------------------------------------------------------
// Conferência
// ---------------------------------------------------------------------------

test('totais separam proventos e descontos', () => {
  assert.deepEqual(totaisEventos([ev('1000', 'provento', 1000), ev('2001', 'desconto', 150.5)]),
    { bruto: 1000, descontos: 150.5, liquido: 849.5 });
});

test('total de descontos da planilha diferente da soma vira divergência (não some em 2100)', () => {
  const eventos = [ev('1000', 'provento', 9000), ev('2001', 'desconto', 100)];
  const r = conferir({ eventos, prestador: prestador({ beneficios: { medico: { ativo: true } } }), config: CONFIG, planilha: { bruto: 9000, descontos_total: 130 } });
  assert.equal(r.conferencia, 'divergente');
  assert.equal(r.abertas[0].tipo, 'descontos_planilha');
  assert.equal(r.abertas[0].diferenca, 30);

  const ajustados = ajustarPorResolucao(eventos, r.abertas[0], 'lancar_diferenca');
  const depois = conferir({ eventos: ajustados, prestador: prestador({ beneficios: { medico: { ativo: true } } }), config: CONFIG, planilha: { bruto: 9000, descontos_total: 130 } });
  assert.equal(depois.conferencia, 'ok');
  assert.equal(ajustados.find((e) => e.codigo === '2100').valor, 30);
});

test('resolução vale só para o valor em que foi dada', () => {
  const eventos = [ev('1000', 'provento', 9000), ev('2100', 'desconto', 100)];
  const planilha = { bruto: 9000, descontos_total: 130 };
  const r = conferir({ eventos, prestador: prestador(), config: CONFIG, planilha });
  const resolucoes = [{ chave: r.abertas[0].chave, acao: 'manter_colunas' }];
  assert.equal(conferir({ eventos, prestador: prestador(), config: CONFIG, planilha, resolucoes }).conferencia, 'ok');

  const outraPlanilha = { bruto: 9000, descontos_total: 140 };
  assert.equal(conferir({ eventos, prestador: prestador(), config: CONFIG, planilha: outraPlanilha, resolucoes }).conferencia, 'divergente');
});

test('bruto da planilha x envelope respeita a tolerância', () => {
  const eventos = [ev('1000', 'provento', 9000)];
  assert.equal(conferir({ eventos, prestador: prestador(), config: CONFIG, planilha: { bruto: 9000.01 } }).conferencia, 'ok');
  const r = conferir({ eventos, prestador: prestador(), config: CONFIG, planilha: { bruto: 9500 } });
  assert.equal(r.abertas[0].tipo, 'bruto_planilha');
  const usados = ajustarPorResolucao(eventos, r.abertas[0], 'usar_planilha');
  assert.equal(usados[0].valor, 9500);
  assert.equal(usados[0].forcado, true);
});

test('rateio fora de 100% e plano sem benefício', () => {
  const r = conferir({
    eventos: [ev('1000', 'provento', 9000), ev('2001', 'desconto', 300)],
    prestador: prestador(), config: CONFIG,
    rateios: [{ cod_ct: 'A', percentual: 60 }, { cod_ct: 'B', percentual: 30 }],
  });
  assert.deepEqual(r.abertas.map((d) => d.tipo).sort(), ['plano_sem_beneficio', 'rateio']);
});

test('termo bloqueia com divergência e libera quando resolve', () => {
  assert.equal(termoApos({ termoAtual: 'gerado', conferencia: 'divergente', config: CONFIG }), 'bloqueado');
  assert.equal(termoApos({ termoAtual: 'bloqueado', conferencia: 'ok', config: CONFIG }), 'disponivel');
  assert.equal(termoApos({ termoAtual: 'gerado', conferencia: 'ok', config: CONFIG }), 'gerado');
  assert.equal(termoApos({ termoAtual: 'disponivel', conferencia: 'divergente', config: { bloquear_termo_divergencia: false } }), 'disponivel');
});

test('calcularEnvelope monta o payload da RPC e invalida termo enviado quando o valor muda', () => {
  const envelope = { bruto: 9000, descontos: 0, termo: 'gerado', envio: 'enviado', calculado_em: '2026-08-02', resolucoes: [] };
  const { payload } = calcularEnvelope({
    envelope, eventos: [ev('1000', 'provento', 9000)], prestador: prestador({ data_fim: '2026-08-20' }), config: CONFIG, competencia: AGO,
  });
  assert.equal(payload.bruto, 6000);
  assert.equal(payload.termo, 'disponivel');
  assert.equal(payload.envio, 'nao_enviado');
  assert.equal(payload.calculo.bruto_anterior, 9000);
  assert.match(payload.calculo.memoria.eventos[0].formula, /÷ 30 dias × 20 dias/);
});

// ---------------------------------------------------------------------------
// Encerramento
// ---------------------------------------------------------------------------

test('validação do encerramento', () => {
  const base = { data_calculo: '2026-08-20', data_encerramento: '2026-08-20', data_pagamento: '2026-09-01', data_ultimo_movimento: '2026-08-20', motivo: 'Término do projeto' };
  assert.equal(validarEncerramento({ dados: base, prestador: prestador(), competencia: AGO }), null);
  assert.match(validarEncerramento({ dados: { ...base, data_encerramento: '2026-09-02' }, prestador: prestador(), competencia: AGO }), /dentro da competência/);
  assert.match(validarEncerramento({ dados: { ...base, data_ultimo_movimento: '2026-08-25' }, prestador: prestador(), competencia: AGO }), /último movimento/);
  assert.match(validarEncerramento({ dados: { ...base, motivo: 'x' }, prestador: prestador(), competencia: AGO }), /motivo/);
});

test('cálculo do encerramento com indenização', () => {
  const r = calcularEncerramento({
    dados: { data_encerramento: '2026-08-15', indenizacao: true }, prestador: prestador(), competencia: AGO, config: CONFIG,
    eventos: [ev('1000', 'provento', 9000), ev('2001', 'desconto', 500)],
  });
  assert.equal(r.valorProporcional, 4500);
  assert.equal(r.valorIndenizacao, 4500);
  assert.equal(r.liquido, 8500);
});

test('assunto do e-mail troca a competência', () => {
  assert.equal(substituirAssunto('Termo — {{competencia}}', AGO), 'Termo — 08/2026');
});
