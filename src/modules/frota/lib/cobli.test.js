import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cobliParse, planoCobli, novoMensalDoCobli, ERRO_CABECALHO, OBS_CRIADO_PELO_COBLI,
} from './cobli.js';

// Relatório no formato do Cobli: título e filtros no topo, cabeçalho, linhas.
const relatorio = (corpo, topo = [
  ['Relatório de Distância percorrida'],
  ['Período: 01/03/2026 até 31/03/2026'],
  ['Distância total percorrida: 3.456,78 km'],
  [],
]) => [...topo, ['Placa', 'Grupo', 'Modelo', 'Distância percorrida (km)'], ...corpo];

test('cobliParse acha o cabeçalho abaixo do título, com acento e caixa diferentes', () => {
  const p = cobliParse(relatorio([['ABC-1D23', 'Obra Norte', 'Onix', '1.234,56']]));
  assert.deepEqual(p.linhas, [{
    placa: 'ABC1D23', km: 1234.56, grupo: 'Obra Norte', modelo: 'Onix',
  }]);
  const semAcento = cobliParse([['PLACA', 'DISTANCIA PERCORRIDA'], ['XYZ9876', 12]]);
  assert.deepEqual(semAcento.linhas, [{
    placa: 'XYZ9876', km: 12, grupo: '', modelo: '',
  }]);
});

test('cobliParse sem cabeçalho lança o erro com a orientação', () => {
  assert.throws(() => cobliParse([['Nome', 'Valor'], ['a', 1]]), { message: ERRO_CABECALHO });
  assert.throws(() => cobliParse([]), { message: ERRO_CABECALHO });
  // "Placa" precisa ser a célula inteira; só conter não basta.
  assert.throws(() => cobliParse([['Placa do veículo', 'Distância']]), { message: ERRO_CABECALHO });
  // Cabeçalho depois da linha 40 não é procurado.
  const longe = [...Array.from({ length: 40 }, () => ['']), ['Placa', 'Distância']];
  assert.throws(() => cobliParse(longe), { message: ERRO_CABECALHO });
});

test('cobliParse lê o período do texto acima do cabeçalho', () => {
  const p = cobliParse(relatorio([['ABC1D23', 'G', 'M', 10]]));
  assert.equal(p.ini, '2026-03-01');
  assert.equal(p.fim, '2026-03-31');
  assert.equal(p.comp, '2026-03');
  const comHifen = cobliParse(relatorio([['ABC1D23', 'G', 'M', 10]], [['Periodo 01/02/2026 - 28/02/2026']]));
  assert.equal(comHifen.ini, '2026-02-01');
  assert.equal(comHifen.fim, '2026-02-28');
  const comA = cobliParse(relatorio([['ABC1D23', 'G', 'M', 10]], [['Filtro', 'Período: 05/01/2026 a 04/02/2026']]));
  assert.equal(comA.ini, '2026-01-05');
  assert.equal(comA.fim, '2026-02-04');
});

test('cobliParse sem período no texto usa o nome do arquivo; sem nenhum, fica vazio', () => {
  const corpo = [['Placa', 'Distância percorrida'], ['ABC1D23', 10]];
  const p = cobliParse(corpo, 'distancia_percorrida_260401_0000_260430_2359.xlsx');
  assert.equal(p.ini, '2026-04-01');
  assert.equal(p.fim, '2026-04-30');
  assert.equal(p.comp, '2026-04');
  const nada = cobliParse(corpo, 'relatorio.xlsx');
  assert.equal(nada.ini, '');
  assert.equal(nada.fim, '');
  assert.equal(nada.comp, '');
  // O texto do relatório vale sobre o nome do arquivo.
  const ambos = cobliParse(relatorio([['ABC1D23', 'G', 'M', 10]]), 'x_260401_0000_260430_2359.xlsx');
  assert.equal(ambos.ini, '2026-03-01');
});

test('cobliParse lê o total do relatório e soma as linhas', () => {
  const p = cobliParse(relatorio([
    ['ABC1D23', 'G', 'M', '1.000,50'],
    ['DEF4G56', 'G', 'M', 2456.28],
  ]));
  assert.equal(p.total, 3456.78);
  assert.equal(p.soma, 3456.78);
  const semTotal = cobliParse([['Placa', 'Distância'], ['ABC1D23', 5]]);
  assert.equal(semTotal.total, null);
  assert.equal(semTotal.soma, 5);
});

test('cobliParse soma placa repetida, guarda grupo e modelo da primeira e ignora linha incompleta', () => {
  const p = cobliParse(relatorio([
    ['ABC1D23', 'Obra A', 'Onix', 100.111],
    ['', 'Obra A', 'Onix', 50],
    ['Total', '', '', 999],
    ['DEF4G56', 'Obra B', 'Strada', ''],
    ['abc-1d23', 'Obra B', 'Onix Plus', 0.222],
  ]));
  assert.equal(p.linhas.length, 1);
  assert.deepEqual(p.linhas[0], {
    placa: 'ABC1D23', km: 100.33, grupo: 'Obra A', modelo: 'Onix',
  });
  assert.equal(p.soma, 100.33);
});

// ------------------------------------------------------------------ plano
const veiculos = [
  { id: 'v1', placa: 'AAA1A11', status: 'Ativo', modelo: 'Onix', condutor: 'Fulano' },
  { id: 'v2', placa: 'BBB2B22', status: 'Ativo' },
  { id: 'v3', placa: 'CCC3C33', status: 'Ativo' },
  { id: 'v4', placa: 'DDD4D44', status: 'Inativo' },
  { id: 'v5', placa: 'EEE5E55', status: 'Ativo' },
  { id: 'v6', placa: 'GGG7G77', status: 'Ativo' },
];
const mensal = [
  { id: 'm1', competencia: '2026-03', placa: 'AAA1A11', km_rodado_inf: null },
  { id: 'm2', competencia: '2026-03', placa: 'BBB2B22', km_rodado_inf: 500 },
  { id: 'm3', competencia: '2026-03', placa: 'CCC3C33', km_rodado_inf: 300.004 },
  // Outra competência não conta.
  { id: 'm9', competencia: '2026-02', placa: 'EEE5E55', km_rodado_inf: null },
];
const dados = { veiculos, mensal };
const linhas = [
  { placa: 'AAA1A11', km: 100, grupo: '', modelo: '' },
  { placa: 'BBB2B22', km: 700, grupo: '', modelo: '' },
  { placa: 'CCC3C33', km: 300, grupo: '', modelo: '' },
  { placa: 'DDD4D44', km: 50, grupo: '', modelo: '' },
  { placa: 'EEE5E55', km: 80, grupo: '', modelo: '' },
  { placa: 'FFF6F66', km: 90, grupo: '', modelo: '' },
  { placa: 'GGG7G77', km: 0, grupo: '', modelo: '' },
];
const porPlaca = (plano) => Object.fromEntries(plano.map((x) => [x.placa, x]));

test('planoCobli decide a ação de cada placa', () => {
  const p = porPlaca(planoCobli(linhas, '2026-03', { criar: true, zero: false }, dados));
  assert.equal(p.AAA1A11.acao, 'Preencher');
  assert.equal(p.AAA1A11.tom, 'ok');
  assert.equal(p.AAA1A11.grava, true);
  assert.equal(p.AAA1A11.ms.id, 'm1');
  assert.equal(p.AAA1A11.v.id, 'v1');
  assert.equal(p.BBB2B22.acao, 'Atualizar');
  assert.equal(p.BBB2B22.grava, true);
  assert.equal(p.CCC3C33.acao, 'Já preenchido');
  assert.equal(p.CCC3C33.grava, false);
  assert.equal(p.DDD4D44.acao, 'Veículo inativo sem lançamento no mês');
  assert.equal(p.DDD4D44.tom, 'warn');
  assert.equal(p.DDD4D44.grava, false);
  assert.equal(p.EEE5E55.acao, 'Criar lançamento e preencher');
  assert.equal(p.EEE5E55.tom, 'info');
  assert.equal(p.EEE5E55.grava, true);
  assert.equal(p.EEE5E55.ms, null);
  assert.equal(p.FFF6F66.acao, 'Placa não cadastrada');
  assert.equal(p.FFF6F66.tom, 'warn');
  assert.equal(p.FFF6F66.v, null);
  assert.equal(p.GGG7G77.acao, 'Ignorado (0 km)');
  assert.equal(p.GGG7G77.grava, false);
});

test('planoCobli sem "criar" deixa o veículo sem lançamento de fora', () => {
  const p = porPlaca(planoCobli(linhas, '2026-03', { criar: false, zero: false }, dados));
  assert.equal(p.EEE5E55.acao, 'Sem lançamento no mês');
  assert.equal(p.EEE5E55.tom, 'warn');
  assert.equal(p.EEE5E55.grava, false);
});

test('planoCobli com "zero" trata a placa de 0 km como as outras', () => {
  const p = porPlaca(planoCobli(linhas, '2026-03', { criar: true, zero: true }, dados));
  assert.equal(p.GGG7G77.acao, 'Criar lançamento e preencher');
  assert.equal(p.GGG7G77.grava, true);
  // 0 km sobre lançamento já zerado é "Já preenchido".
  const z = planoCobli([{ placa: 'AAA1A11', km: 0 }], '2026-03', { zero: true }, {
    veiculos, mensal: [{ id: 'x', competencia: '2026-03', placa: 'AAA1A11', km_rodado_inf: 0 }],
  });
  assert.equal(z[0].acao, 'Já preenchido');
});

test('planoCobli ordena: grava primeiro, depois km decrescente, depois placa', () => {
  const extra = [...linhas, { placa: 'HHH8H88', km: 90, grupo: '', modelo: '' }];
  const ordem = planoCobli(extra, '2026-03', { criar: true, zero: false }, dados).map((x) => x.placa);
  assert.deepEqual(ordem, [
    'BBB2B22', 'AAA1A11', 'EEE5E55', // gravam: 700, 100, 80
    'CCC3C33', 'FFF6F66', 'HHH8H88', 'DDD4D44', 'GGG7G77', // não gravam: 300, 90, 90 (placa), 50, 0
  ]);
});

test('novoMensalDoCobli copia o contrato do veículo e grava o km como Cobli', () => {
  const v = {
    id: 'v1', placa: 'AAA1A11', status: 'Ativo', modelo: 'Onix', condutor: 'Fulano', locadora: 'Locadora X',
    grupo: 'B', codigo_reserva: 'R1', contrato: 'C1', retirada: '2026-01-10', devolucao: null, ct: 'CT-1',
    custo_resp: 'PHD', gps_valor: 50, gps_numero: '123', km_contratado: 3000, custo_mensal: 2500, recarga_mensal: 800,
    cor: 'Branco', valor_km_excedente: 1.2,
  };
  const n = novoMensalDoCobli(v, '2026-03', 1234.5, '2026-04-02T12:00:00.000Z');
  assert.deepEqual(n, {
    competencia: '2026-03',
    status: 'Ativo',
    condutor: 'Fulano',
    placa: 'AAA1A11',
    modelo: 'Onix',
    locadora: 'Locadora X',
    grupo: 'B',
    codigo_reserva: 'R1',
    contrato: 'C1',
    retirada: '2026-01-10',
    devolucao: null,
    ct: 'CT-1',
    custo_resp: 'PHD',
    gps_valor: 50,
    gps_numero: '123',
    km_contratado: 3000,
    custo_locacao: 2500,
    recarga_mensal: 800,
    km_rodado_inf: 1234.5,
    km_fonte: 'Cobli',
    km_importado_em: '2026-04-02T12:00:00.000Z',
    obs: OBS_CRIADO_PELO_COBLI,
  });
  // Campo ausente no veículo vira null, não undefined (insert em lote).
  const vazio = novoMensalDoCobli({ placa: 'ZZZ0Z00' }, '2026-03', 1, 'x');
  assert.equal(vazio.condutor, null);
  assert.equal(vazio.custo_locacao, null);
});
