import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CFG, extrasOf, combOf, totalOf, kmRodado, revisao, termoValidade, conformidade, ocAberta,
  patchVeiculo, gerarCompetencia, duplicado, groupSum, parseBR, addMonths, todayISO, compLabel, compLong,
  compNext, compPrev, lastComp, placaAtualDe, ocsDe, contagensNav, OC_STATUS, TIPOS_MAN, CAT_MULTA, CAT_AVARIA,
  kmAnterior, origemDoKm, vinculoDe, vinculosPlaca, placaDe, numDe, prepararVinculo, trocaDeCondutor,
  vinculoPeloVeiculo,
  PLACA_RE, norm,
} from './regras.js';

const emDias = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

test('extras somam multas, avarias, laudos, adesivo e frete, ignorando vazios', () => {
  assert.equal(extrasOf({ multas: 10, avarias: 20, laudos: 30, adesivo: 40, frete: 50 }), 150);
  assert.equal(extrasOf({ multas: 10, avarias: null }), 10);
  assert.equal(extrasOf({}), 0);
});

test('total do mês não inclui combustível', () => {
  const m = { custo_locacao: 1000, gps_valor: 50, multas: 100, recarga_mes: 500, recarga_mensal: 800 };
  assert.equal(totalOf(m), 1150);
});

test('combustível: valor informado vence; em branco é limite menos saldo, nunca negativo', () => {
  assert.equal(combOf({ recarga_mes: 300, recarga_mensal: 800, saldo_remanescente: 100 }), 300);
  assert.equal(combOf({ recarga_mensal: 800, saldo_remanescente: 100 }), 700);
  assert.equal(combOf({ recarga_mensal: 100, saldo_remanescente: 300 }), 0);
  assert.equal(combOf({ recarga_mensal: 800 }), null);
  assert.equal(combOf({ recarga_mes: 0 }), 0);
});

test('km rodado compara com a competência anterior da mesma placa', () => {
  const mensal = [
    { competencia: '2026-01', placa: 'AAA1A11', km_atual: 10000 },
    { competencia: '2026-02', placa: 'AAA1A11', km_atual: 12500 },
    { competencia: '2026-02', placa: 'BBB2B22', km_atual: 30000 },
  ];
  assert.equal(kmRodado(mensal[1], mensal), 2500);
  assert.equal(kmRodado(mensal[0], mensal), null, 'sem mês anterior');
  assert.equal(kmRodado(mensal[2], mensal), null, 'mês anterior é de outra placa');
  assert.equal(kmRodado({ competencia: '2026-02', km_atual: 5 }, mensal), null, 'sem placa');
});

test('km rodado descarta leitura negativa, zerada ou acima de 15 mil', () => {
  const base = { competencia: '2026-01', placa: 'AAA1A11', km_atual: 10000 };
  const mes = (km) => ({ competencia: '2026-02', placa: 'AAA1A11', km_atual: km });
  assert.equal(kmRodado(mes(9000), [base]), null);
  assert.equal(kmRodado(mes(10000), [base]), null);
  assert.equal(kmRodado(mes(25000), [base]), null);
  assert.equal(kmRodado(mes(24999), [base]), 14999);
});

test('competência atravessa a virada do ano', () => {
  assert.equal(compPrev('2026-01'), '2025-12');
  assert.equal(compNext('2025-12'), '2026-01');
  assert.equal(compLabel('2026-03'), 'Mar/2026');
  assert.equal(compLong('2026-03'), 'Março de 2026');
  assert.equal(compLabel(''), '—');
  assert.equal(lastComp([{ competencia: '2026-01' }, { competencia: '2026-03' }, { competencia: '2025-12' }]), '2026-03');
});

test('revisão por km: em dia, programar e vencida nos limites exatos', () => {
  const r = (km) => revisao({ km_atual: km, km_ultima_manutencao: 0 });
  assert.equal(r(8499).label, 'Em dia');
  assert.equal(r(8500).label, 'Programar revisão');
  assert.equal(r(8500).lvl, 1);
  assert.equal(r(9999).lvl, 1);
  assert.equal(r(10000).label, 'Revisão vencida');
  assert.equal(r(10000).lvl, 2);
  assert.equal(r(8000).prox, 10000);
  assert.equal(r(8000).desde, 8000);
});

test('revisão sem registro não acusa nada; km sem última manutenção sugere o múltiplo seguinte', () => {
  assert.deepEqual(revisao({}), { tone: 'neutral', label: 'Sem registro', lvl: 0, desde: null, prox: null });
  const r = revisao({ km_atual: 12000 });
  assert.equal(r.label, 'Sem registro');
  assert.equal(r.prox, 20000);
});

test('revisão por data: vencida e próxima; km vencido não é rebaixado pela data', () => {
  assert.equal(revisao({ data_proxima_revisao: emDias(-1) }).label, 'Data de revisão vencida');
  assert.equal(revisao({ data_proxima_revisao: emDias(15) }).label, 'Revisão próxima');
  assert.equal(revisao({ data_proxima_revisao: emDias(16) }).label, 'Em dia');
  const v = { km_atual: 10000, km_ultima_manutencao: 0, data_proxima_revisao: emDias(-1) };
  assert.equal(revisao(v).label, 'Revisão vencida');
});

test('revisão respeita os parâmetros configurados', () => {
  const cfg = { ...DEFAULT_CFG, intervalo_revisao_km: 5000, margem_revisao_km: 500 };
  assert.equal(revisao({ km_atual: 4500, km_ultima_manutencao: 0 }, cfg).label, 'Programar revisão');
  assert.equal(revisao({ km_atual: 5000, km_ultima_manutencao: 0 }, cfg).label, 'Revisão vencida');
});

test('validade do termo: explícita vence; em branco é assinatura mais a validade padrão', () => {
  assert.equal(termoValidade({ termo_validade: '2030-01-01', termo_assinatura: '2026-01-01' }), '2030-01-01');
  assert.equal(termoValidade({ termo_assinatura: '2026-01-15' }), '2027-01-15');
  assert.equal(termoValidade({ termo_assinatura: '2026-01-15' }, { ...DEFAULT_CFG, validade_termo_meses: 6 }), '2026-07-15');
  assert.equal(termoValidade({}), '');
});

test('conformidade: CNH', () => {
  const termoOk = { termo_assinatura: todayISO(), termo_arquivo: { path: 'x' } };
  assert.equal(conformidade({ nome: 'A', ...termoOk }).cnh.label, 'CNH não registrada');
  assert.equal(conformidade({ nome: 'A', cnh_validade: emDias(-1), ...termoOk }).cnh.label, 'CNH vencida');
  assert.equal(conformidade({ nome: 'A', cnh_validade: emDias(30), ...termoOk }).cnh.label, 'CNH vence em 30 d');
  assert.equal(conformidade({ nome: 'A', cnh_validade: emDias(31), ...termoOk }).cnh.label, 'CNH válida');
});

test('conformidade: termo', () => {
  const cnh = { nome: 'Ana', cnh_validade: emDias(400) };
  const arq = { path: 'x' };
  assert.equal(conformidade(cnh).termo.label, 'Termo pendente');
  assert.equal(conformidade({ ...cnh, termo_assinatura: emDias(-400), termo_arquivo: arq }).termo.label, 'Termo vencido');
  assert.equal(conformidade({ ...cnh, termo_assinatura: todayISO() }).termo.label, 'Termo sem anexo');
  assert.equal(conformidade({ ...cnh, termo_validade: emDias(10), termo_arquivo: arq }).termo.label, 'Termo vence em 10 d');
  const veic = [{ status: 'Ativo', placa: 'NOV1A11', condutor: 'Ana' }];
  assert.equal(conformidade({ ...cnh, termo_assinatura: todayISO(), termo_arquivo: arq, termo_placa: 'VEL1A11' }, veic).termo.label, 'Termo de outro veículo');
  assert.equal(conformidade({ ...cnh, termo_assinatura: todayISO(), termo_arquivo: arq, termo_placa: 'NOV1A11' }, veic).termo.label, 'Termo em dia');
});

test('conformidade geral é o pior dos dois', () => {
  const arq = { path: 'x' };
  assert.equal(conformidade({ nome: 'A', cnh_validade: emDias(400), termo_assinatura: todayISO(), termo_arquivo: arq }).geral.label, 'Regular');
  assert.equal(conformidade({ nome: 'A', cnh_validade: emDias(10), termo_assinatura: todayISO(), termo_arquivo: arq }).geral.label, 'Atenção');
  assert.equal(conformidade({ nome: 'A', cnh_validade: emDias(-1), termo_assinatura: todayISO(), termo_arquivo: arq }).geral.label, 'Irregular');
});

test('condutor "A / B": os dois nomes contam, sem acento nem caixa', () => {
  const veic = [
    { status: 'Inativo', placa: 'OLD1A11', condutor: 'João' },
    { status: 'Ativo', placa: 'NOV1A11', condutor: 'Maria / João da Silva' },
  ];
  assert.equal(placaAtualDe('joao da silva', veic), 'NOV1A11');
  assert.equal(placaAtualDe('João', veic), '');
  const ocs = [{ condutor: 'Maria / João' }, { condutor: 'Pedro' }];
  assert.equal(ocsDe('JOAO', ocs).length, 1);
  assert.equal(norm(' Ávila '), 'avila');
});

test('ocorrência em aberto: Aberta, Em tratativa ou sem status', () => {
  assert.equal(ocAberta({ status: 'Aberta' }), true);
  assert.equal(ocAberta({ status: 'Em tratativa' }), true);
  assert.equal(ocAberta({}), true);
  for (const s of OC_STATUS.slice(2)) assert.equal(ocAberta({ status: s }), false, s);
});

test('efeito no veículo: km só sobe, próxima revisão sobrescreve, nada muda devolve null', () => {
  const v = { km_atual: 1000, km_ultima_manutencao: 500, data_ultima_revisao: '2026-01-10', data_proxima_revisao: '2026-07-01' };
  assert.equal(patchVeiculo(v, { km_atual: 900 }), null);
  assert.deepEqual(patchVeiculo(v, { km_atual: 1100 }), { km_atual: 1100 });
  assert.equal(patchVeiculo(v, { km_ultima_manutencao: 400 }), null);
  assert.deepEqual(patchVeiculo(v, { km_ultima_manutencao: 500 }), { km_ultima_manutencao: 500 });
  assert.equal(patchVeiculo(v, { data_ultima_revisao: '2026-01-01' }), null);
  assert.deepEqual(patchVeiculo(v, { data_proxima_revisao: '2026-02-01' }), { data_proxima_revisao: '2026-02-01' });
  assert.equal(patchVeiculo(v, { data_proxima_revisao: null }), null);
});

test('gerar competência copia o que se repete e começa o resto em branco', () => {
  const veiculos = [
    { status: 'Ativo', placa: 'AAA1A11', condutor: 'Ana', custo_mensal: 900, gps_valor: 40, recarga_mensal: 500, km_contratado: 3000 },
    { status: 'Reservado', placa: null, condutor: 'Bia', custo_mensal: 800 },
    { status: 'Inativo', placa: 'CCC1C11', condutor: 'Caio' },
  ];
  const mensal = [{ competencia: '2026-03', placa: 'AAA1A11', condutor: 'Ana', custo_locacao: 950, gps_valor: 45, multas: 200, km_atual: 5000, saldo_remanescente: 10 }];
  const g = gerarCompetencia(veiculos, mensal);
  assert.equal(g.de, '2026-03');
  assert.equal(g.para, '2026-04');
  assert.equal(g.todo.length, 2);
  const [ana, bia] = g.todo;
  assert.equal(ana.custo_locacao, 950, 'o último mês vence o cadastro');
  assert.equal(ana.gps_valor, 45);
  assert.equal(ana.recarga_mensal, 500);
  assert.equal(ana.multas, undefined);
  assert.equal(ana.km_atual, undefined);
  assert.equal(ana.saldo_remanescente, undefined);
  assert.equal(bia.custo_locacao, 800, 'sem mês anterior vem do cadastro');
  assert.equal(bia.status, 'Ativo');
});

test('gerar competência não repete o que já existe no mês de destino', () => {
  const veiculos = [{ status: 'Ativo', placa: 'AAA1A11', condutor: 'Ana' }, { status: 'Reservado', placa: null, condutor: 'Bia' }];
  const mensal = [
    { competencia: '2026-03', placa: 'AAA1A11', condutor: 'Ana' },
    { competencia: '2026-04', placa: 'AAA1A11', condutor: 'Ana' },
  ];
  assert.equal(gerarCompetencia(veiculos, mensal).para, '2026-05');
  const so3 = [mensal[0]];
  assert.equal(gerarCompetencia(veiculos, so3).todo.length, 2);
});

test('duplicado pela chave natural, ignorando o próprio registro', () => {
  const dados = {
    veiculos: [{ id: '1', placa: 'AAA1A11' }],
    mensal: [{ id: '2', competencia: '2026-01', placa: 'AAA1A11', condutor: 'Ana' }, { id: '3', competencia: '2026-01', placa: null, condutor: 'Bia' }],
    condutores: [{ id: '4', nome: 'João Silva' }],
  };
  assert.equal(duplicado('veiculos', { placa: 'AAA1A11' }, null, dados), 'AAA1A11');
  assert.equal(duplicado('veiculos', { placa: 'AAA1A11' }, '1', dados), null);
  assert.equal(duplicado('veiculos', { placa: null }, null, dados), null);
  assert.ok(duplicado('mensal', { competencia: '2026-01', placa: 'AAA1A11', condutor: 'X' }, null, dados));
  assert.ok(duplicado('mensal', { competencia: '2026-01', placa: null, condutor: 'bia' }, null, dados));
  assert.equal(duplicado('mensal', { competencia: '2026-02', placa: 'AAA1A11' }, null, dados), null);
  assert.equal(duplicado('condutores', { nome: 'JOAO SILVA' }, null, dados), 'JOAO SILVA');
  assert.equal(duplicado('condutores', { nome: 'João Silva' }, '4', dados), null);
  assert.equal(duplicado('ocorrencias', { placa: 'AAA1A11' }, null, dados), null);
});

test('agrupamento soma, descarta zero e junta o excedente em Outros', () => {
  const rows = [{ k: 'a', v: 5 }, { k: 'a', v: 5 }, { k: 'b', v: 3 }, { k: 'c', v: 2 }, { k: 'd', v: 1 }, { k: null, v: 4 }, { k: 'zero', v: 0 }];
  const g = groupSum(rows, (r) => r.k, (r) => r.v, 3);
  assert.deepEqual(g, [{ l: 'a', v: 10 }, { l: 'Não informado', v: 4 }, { l: 'Outros (3)', v: 6 }]);
});

test('número em formato brasileiro', () => {
  assert.equal(parseBR('1.234,56'), 1234.56);
  assert.equal(parseBR('R$ 99,9'), 99.9);
  assert.equal(parseBR('1234.5'), 1234.5);
  assert.equal(parseBR('21.000'), 21000, 'ponto como milhar, sem vírgula');
  assert.equal(parseBR('1.234.567'), 1234567);
  assert.equal(parseBR('2.97'), 2.97, 'dois dígitos depois do ponto é decimal');
  assert.equal(parseBR(''), null);
  assert.equal(parseBR('abc'), null);
  assert.equal(parseBR(null), null);
});

test('soma de meses', () => {
  assert.equal(addMonths('2026-01-15', 12), '2027-01-15');
  assert.equal(addMonths('', 12), '');
});

test('placa aceita os dois formatos', () => {
  assert.ok(PLACA_RE.test('ABC1D23'));
  assert.ok(PLACA_RE.test('ABC1234'));
  assert.ok(!PLACA_RE.test('AB1234'));
  assert.ok(!PLACA_RE.test('abc1d23'));
});

test('contadores da sidebar só contam ativos críticos', () => {
  const dados = {
    condutores: [{ nome: 'A', situacao: 'Ativo' }, { nome: 'B', situacao: 'Desligado' }],
    veiculos: [
      { status: 'Ativo', km_atual: 20000, km_ultima_manutencao: 0 },
      { status: 'Inativo', km_atual: 20000, km_ultima_manutencao: 0 },
      { status: 'Ativo', km_atual: 100, km_ultima_manutencao: 0 },
    ],
  };
  assert.deepEqual(contagensNav(dados, DEFAULT_CFG), { condutores: 1, manutencao: 1 });
});

test('listas de constantes do protótipo', () => {
  assert.equal(OC_STATUS.length, 6);
  assert.equal(TIPOS_MAN.length, 8);
  assert.equal(CAT_MULTA.length, 9);
  assert.equal(CAT_AVARIA.length, 10);
});

test('km rodado informado vale sobre o hodômetro, sem trava de faixa', () => {
  const ant = { competencia: '2026-01', placa: 'AAA1A11', km_atual: 10000 };
  const m = { competencia: '2026-02', placa: 'AAA1A11', km_atual: 12000 };
  assert.equal(kmRodado({ ...m, km_rodado_inf: 1834.5 }, [ant]), 1834.5);
  assert.equal(kmRodado({ ...m, km_rodado_inf: 20000 }, [ant]), 20000);
  assert.equal(kmRodado(m, [ant]), 2000);
  assert.equal(kmAnterior(m, [ant]), 10000);
  assert.equal(kmAnterior({ ...m, placa: null }, [ant]), null);
  assert.equal(origemDoKm({ ...m, km_rodado_inf: 5, km_fonte: 'Cobli' }, [ant]), 'Cobli');
  assert.equal(origemDoKm({ ...m, km_rodado_inf: 5 }, [ant]), 'informado');
  assert.equal(origemDoKm(m, [ant]), 'pelo hodômetro');
  assert.equal(origemDoKm({ ...m, km_atual: null }, [ant]), 'sem leitura');
});

test('vínculo condutor-veículo: vale com condutor e veículo ativos; sem ele, a regra antiga', () => {
  const veiculos = [
    { placa: 'AAA1A11', status: 'Ativo', condutor: 'Outro' },
    { placa: 'BBB2B22', status: 'Inativo', condutor: 'Bia' },
    { placa: 'CCC3C33', status: 'Reservado', condutor: 'Caio' },
  ];
  const condutores = [
    { id: 1, nome: 'Ana', situacao: 'Ativo', placa_vinculada: 'AAA1A11', tipo_condutor: 'Adicional' },
    { id: 2, nome: 'Bia', situacao: 'Ativo', placa_vinculada: 'BBB2B22' },
    { id: 3, nome: 'Caio', situacao: 'Ativo' },
    { id: 4, nome: 'Davi', situacao: 'Ativo', placa_vinculada: 'AAA1A11', tipo_condutor: 'Principal' },
    { id: 5, nome: 'Eva', situacao: 'Inativo', placa_vinculada: 'AAA1A11', tipo_condutor: 'Adicional' },
  ];
  assert.deepEqual(vinculoDe('ana', condutores, veiculos), { placa: 'AAA1A11', tipo: 'Adicional' });
  assert.equal(vinculoDe('Bia', condutores, veiculos), null, 'veículo inativo');
  assert.equal(placaAtualDe('Ana', veiculos, condutores[0]), 'AAA1A11');
  assert.equal(placaAtualDe('Caio', veiculos, condutores[2]), 'CCC3C33', 'regra antiga');
  const vp = vinculosPlaca('AAA1A11', condutores);
  assert.equal(vp.principal.nome, 'Davi');
  assert.deepEqual(vp.adicionais.map((c) => c.nome), ['Ana']);
  assert.equal(vinculosPlaca('AAA1A11', condutores, 4).principal, null);
});

test('placa e número em célula de planilha', () => {
  assert.equal(placaDe('abc-1d23 (Onix)'), 'ABC1D23');
  assert.equal(placaDe('ABC 1234'), 'ABC1234');
  assert.equal(placaDe('sem placa'), '');
  assert.equal(numDe(1234.5), 1234.5);
  assert.equal(numDe('1.234,5 km'), 1234.5);
  assert.equal(numDe('21.000'), 21000);
  assert.equal(numDe(''), null);
});

test('vínculo ao salvar o condutor: tipo padrão, limites e placa do termo', () => {
  const conds = [
    { id: 1, nome: 'Davi', situacao: 'Ativo', placa_vinculada: 'AAA1A11', tipo_condutor: 'Principal' },
    ...[2, 3, 4, 5, 6].map((id) => ({ id, nome: `Adic ${id}`, situacao: 'Ativo', placa_vinculada: 'BBB2B22', tipo_condutor: 'Adicional' })),
  ];
  assert.match(prepararVinculo({ situacao: 'Ativo', placa_vinculada: 'AAA1A11' }, 9, conds).erro, /já tem condutor principal \(Davi\)/);
  assert.equal(prepararVinculo({ situacao: 'Ativo', placa_vinculada: 'AAA1A11' }, 1, conds).vals.tipo_condutor, 'Principal', 'o próprio principal salva');
  assert.match(prepararVinculo({ situacao: 'Ativo', placa_vinculada: 'BBB2B22', tipo_condutor: 'Adicional' }, 9, conds).erro, /5 condutores adicionais/);
  const ok = prepararVinculo({ situacao: 'Ativo', placa_vinculada: 'AAA1A11', tipo_condutor: 'Adicional' }, 9, conds).vals;
  assert.equal(ok.termo_placa, 'AAA1A11');
  assert.equal(prepararVinculo({ situacao: 'Inativo', placa_vinculada: 'AAA1A11' }, 9, conds).erro, undefined, 'inativo não conta');
  assert.equal(prepararVinculo({ situacao: 'Ativo', placa_vinculada: null, tipo_condutor: 'Adicional' }, 9, conds).vals.tipo_condutor, null);
});

test('troca de condutor principal leva o anterior para o histórico do veículo', () => {
  const veiculos = [{ id: 'v1', placa: 'AAA1A11', condutor: 'Velho', contrato: 'C1', locadora: 'Movida', historico: [] }];
  const t = trocaDeCondutor({ situacao: 'Ativo', tipo_condutor: 'Principal', placa_vinculada: 'AAA1A11', nome: 'Novo' }, veiculos, '2026-11-18');
  assert.equal(t.patch.condutor, 'Novo');
  assert.deepEqual(t.patch.historico[0], {
    condutor: 'Velho', contrato: 'C1', retirada: null, devolucao: '2026-11-18', locadora: 'Movida', ct: null, fonte: 'Troca de condutor principal',
  });
  assert.equal(trocaDeCondutor({ situacao: 'Ativo', tipo_condutor: 'Adicional', placa_vinculada: 'AAA1A11', nome: 'Novo' }, veiculos), null);
  assert.equal(trocaDeCondutor({ situacao: 'Ativo', tipo_condutor: 'Principal', placa_vinculada: 'AAA1A11', nome: 'velho' }, veiculos), null);
});

test('veículo com condutor novo vira o vínculo principal, soltando o antigo primeiro', () => {
  const conds = [
    { id: 1, nome: 'Velho', situacao: 'Ativo', placa_vinculada: 'AAA1A11', tipo_condutor: 'Principal' },
    { id: 2, nome: 'Novo', situacao: 'Ativo' },
  ];
  assert.deepEqual(vinculoPeloVeiculo({ placa: 'AAA1A11', condutor: 'Novo' }, { placa: 'AAA1A11', condutor: 'Velho' }, conds), [
    { id: 1, patch: { placa_vinculada: null, tipo_condutor: null } },
    { id: 2, patch: { placa_vinculada: 'AAA1A11', tipo_condutor: 'Principal', situacao: 'Ativo' } },
  ]);
  assert.deepEqual(vinculoPeloVeiculo({ placa: 'AAA1A11', condutor: 'Velho' }, { placa: 'AAA1A11', condutor: 'Velho' }, conds), []);
  assert.deepEqual(vinculoPeloVeiculo({ placa: 'AAA1A11', condutor: 'Velho' }, null, conds), [], 'já é o principal');
});
