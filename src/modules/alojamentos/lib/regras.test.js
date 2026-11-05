import test from 'node:test';
import assert from 'node:assert/strict';
import {
  vagas, invest, custoFixo, temCustoFixo, missing, inicioControle, esperado, contratoInfo, alerts,
  isOn, quartoNome, chaveARecolher, movimentos, resumoCelula, resumoCompetencia, addMonths, compLabel,
  initials, local, alojs, STATUS, CHAVE, PAG_ST, CONTAS,
} from './regras.js';

const HOJE = '2026-11-03';
const baseVazia = (extra = {}) => ({
  alojamentos: [], estadias: [], pagamentos: [], itens: [], ocorrencias: [], ...extra,
});
const aloj = (extra = {}) => ({
  id: 'a1', nome: 'Prado', status: 'ativo', quartos: [], contas: [], pendencias: [], contas_controladas: [], created_at: '2026-09-15T10:00:00Z', ...extra,
});
const completo = {
  endereco: 'Rua X', aluguel_valor: 1500, contrato_fim: '2028-01-01', quartos: [{ id: 'q1', nome: 'Quarto 1', vagas: 1 }], proprietario_nome: 'Ana',
};

test('constantes trazem os estados que as telas e o banco usam', () => {
  assert.deepEqual(Object.keys(STATUS), ['ativo', 'desmobilizacao', 'inativo']);
  assert.deepEqual(Object.keys(PAG_ST), ['pago', 'pendente', 'agendado']);
  assert.equal(CHAVE.pendente.c, 'bad');
  assert.ok(CONTAS.includes('Caução'));
});

test('vagas soma as camas e quarto sem número conta como 1', () => {
  assert.equal(vagas({ quartos: [{ vagas: 2 }, { vagas: 0 }, {}] }), 4);
  assert.equal(vagas({}), 0);
});

test('invest multiplica quantidade por preço só no alojamento pedido', () => {
  const base = baseVazia({
    itens: [
      { alojamento_id: 'a1', quantidade: 2, preco_unitario: 100 },
      { alojamento_id: 'a1', quantidade: 3, preco_unitario: null },
      { alojamento_id: 'a2', quantidade: 9, preco_unitario: 9 },
    ],
  });
  assert.equal(invest(base, 'a1'), 200);
});

test('custoFixo soma aluguel, condomínio e IPTU; temCustoFixo aceita zero, não vazio', () => {
  assert.equal(custoFixo({ aluguel_valor: 1000, condominio_valor: '200.50', iptu: null }), 1200.5);
  assert.equal(temCustoFixo({ aluguel_valor: 0 }), true);
  assert.equal(temCustoFixo({ aluguel_valor: null, condominio_valor: '', iptu: undefined }), false);
});

test('missing lista o que falta no cadastro; imobiliária vale como locador', () => {
  assert.deepEqual(missing(aloj()), ['endereço', 'valor do aluguel', 'fim do contrato', 'quartos', 'locador']);
  assert.deepEqual(missing(aloj({ ...completo, proprietario_nome: null, imobiliaria_nome: 'GR' })), []);
});

test('inicioControle: 1º lançamento, senão mês do cadastro; contrato posterior empurra', () => {
  const a = aloj();
  assert.equal(inicioControle(a, baseVazia(), HOJE), '2026-09');
  const comPagamento = baseVazia({ pagamentos: [{ alojamento_id: 'a1', competencia: '2026-07' }, { alojamento_id: 'a1', competencia: '2026-05' }] });
  assert.equal(inicioControle(a, comPagamento, HOJE), '2026-05');
  assert.equal(inicioControle(aloj({ contrato_inicio: '2026-10-05' }), comPagamento, HOJE), '2026-10');
});

test('esperado só cobra conta controlada, de imóvel em operação, entre o início e o mês atual', () => {
  const a = aloj({ contas_controladas: ['Aluguel'] });
  const base = baseVazia();
  assert.equal(esperado(a, 'Aluguel', '2026-10', base, HOJE), true);
  assert.equal(esperado(a, 'Água', '2026-10', base, HOJE), false);
  assert.equal(esperado(a, 'Aluguel', '2026-08', base, HOJE), false);
  assert.equal(esperado(a, 'Aluguel', '2026-12', base, HOJE), false);
  assert.equal(esperado({ ...a, status: 'inativo' }, 'Aluguel', '2026-10', base, HOJE), false);
});

test('contratoInfo: faixas de 30 e 90 dias, vencido e sem data', () => {
  assert.equal(contratoInfo(aloj(), HOJE).label, 'Sem data de fim');
  assert.equal(contratoInfo(aloj({ contrato_fim: '2026-11-03' }), HOJE).label, '03/11/2026 · hoje');
  assert.equal(contratoInfo(aloj({ contrato_fim: '2026-11-20' }), HOJE).c, 'bad');
  assert.equal(contratoInfo(aloj({ contrato_fim: '2027-01-15' }), HOJE).c, 'warn');
  assert.equal(contratoInfo(aloj({ contrato_fim: '2027-06-01' }), HOJE).c, '');
  const vencido = contratoInfo(aloj({ contrato_fim: '2026-11-01' }), HOJE);
  assert.equal(vencido.label, '01/11/2026 · vencido há 2 d');
  assert.equal(vencido.d, -2);
});

test('contratoInfo: desmobilização olha a entrega prevista; inativo, a devolução', () => {
  const desm = contratoInfo(aloj({ status: 'desmobilizacao', contrato_fim: '2030-01-01', encerramento_previsto: '2026-11-10' }), HOJE);
  assert.equal(desm.alvo, '2026-11-10');
  assert.equal(contratoInfo(aloj({ status: 'inativo', devolucao_data: '2026-01-02' }), HOJE).label, 'Devolvido em 02/01/2026');
  assert.equal(contratoInfo(aloj({ status: 'inativo' }), HOJE).label, 'Encerrado');
});

test('isOn: saída futura ainda mora; saída hoje já saiu', () => {
  assert.equal(isOn({}, HOJE), true);
  assert.equal(isOn({ saida: '2026-11-04' }, HOJE), true);
  assert.equal(isOn({ saida: HOJE }, HOJE), false);
});

test('quartoNome mantém o histórico quando o quarto foi excluído', () => {
  const a = aloj({ quartos: [{ id: 'q1', nome: 'Suíte' }] });
  assert.equal(quartoNome(a, { quarto_id: 'q1' }), 'Suíte');
  assert.equal(quartoNome(a, { quarto_id: null, quarto_nome: 'Quarto 3' }), 'Quarto 3 (removido)');
  assert.equal(quartoNome(a, { quarto_id: null }), 'Sem quarto');
});

test('chaveARecolher: saiu sem devolver, ou marcada como pendente mesmo morando', () => {
  assert.equal(chaveARecolher({ saida: '2026-11-01', chave: 'com_morador' }, HOJE), true);
  assert.equal(chaveARecolher({ saida: '2026-11-01', chave: 'devolvida' }, HOJE), false);
  assert.equal(chaveARecolher({ chave: 'com_morador' }, HOJE), false);
  assert.equal(chaveARecolher({ chave: 'pendente' }, HOJE), true);
});

test('alerts: contrato vencido é crítico, mas com prorrogação automática só informa', () => {
  const vencido = alerts(baseVazia({ alojamentos: [aloj({ ...completo, contrato_fim: '2026-10-01' })] }), HOJE);
  assert.equal(vencido[0].sev, 'bad');
  assert.equal(vencido[0].title, 'Contrato vencido há 33 dias');
  const auto = alerts(baseVazia({ alojamentos: [aloj({ ...completo, contrato_fim: '2026-10-01', contrato_renovacao_automatica: true })] }), HOJE);
  assert.equal(auto[0].sev, 'info');
  assert.equal(auto[0].title, 'Contrato em prorrogação automática');
});

test('alerts: contrato a vencer e desmobilização por faixa', () => {
  const perto = alerts(baseVazia({ alojamentos: [aloj({ ...completo, contrato_fim: '2026-11-20' })] }), HOJE);
  assert.equal(perto[0].sev, 'bad');
  assert.equal(perto[0].title, 'Contrato encerra em 17 dias');
  const medio = alerts(baseVazia({ alojamentos: [aloj({ ...completo, contrato_fim: '2027-01-15' })] }), HOJE);
  assert.equal(medio[0].sev, 'warn');
  const semData = alerts(baseVazia({ alojamentos: [aloj({ status: 'desmobilizacao' })] }), HOJE);
  assert.equal(semData[0].title, 'Desmobilização sem data prevista');
  assert.equal(semData[0].sev, 'warn');
  const atrasada = alerts(baseVazia({ alojamentos: [aloj({ status: 'desmobilizacao', encerramento_previsto: '2026-11-02' })] }), HOJE);
  assert.equal(atrasada[0].title, 'Desmobilização atrasada há 1 dia');
  assert.equal(atrasada[0].sev, 'bad');
});

test('alerts: pendência de imóvel inativo é warn e ele não gera outro alerta', () => {
  const r = alerts(baseVazia({ alojamentos: [aloj({ status: 'inativo', contrato_fim: '2020-01-01', pendencias: [{ texto: 'Vistoria', feito: false }, { texto: 'Caução', feito: true }] })] }), HOJE);
  assert.equal(r.length, 1);
  assert.equal(r[0].sev, 'warn');
  assert.equal(r[0].title, '1 pendência de encerramento');
  assert.equal(r[0].text, 'Vistoria');
});

test('alerts: chave e saída prevista vencida apontam para a aba de ocupação', () => {
  const a = aloj({ ...completo });
  const r = alerts(baseVazia({
    alojamentos: [a],
    estadias: [
      { alojamento_id: 'a1', morador: 'Ana', quarto_id: 'q1', chave: 'pendente' },
      { alojamento_id: 'a1', morador: 'Bia', quarto_id: 'q1', chave: 'com_morador', saida_prevista: '2026-10-30' },
    ],
  }), HOJE);
  assert.equal(r[0].title, 'Chave não devolvida · Ana');
  assert.equal(r[0].tab, 'ocupacao');
  assert.equal(r[1].title, 'Saída prevista vencida · Bia');
  assert.equal(r[1].sev, 'warn');
});

test('alerts: contas sem lançamento e cadastro incompleto levam para a tela geral; ordem por severidade', () => {
  const r = alerts(baseVazia({
    alojamentos: [
      aloj({ id: 'a1', contas_controladas: ['Aluguel', 'Água'] }),
      aloj({ id: 'a2', nome: 'Buritis', ...completo, contrato_fim: '2026-10-01' }),
    ],
    pagamentos: [{ alojamento_id: 'a1', conta: 'Água', competencia: '2026-11' }],
  }), HOJE);
  assert.equal(r[0].sev, 'bad');
  const contas = r.find((x) => x.go === 'pagamentos');
  assert.equal(contas.title, 'Novembro de 2026: 1 de 2 contas sem lançamento');
  assert.equal(contas.text, '1 alojamento com contas a lançar na competência atual.');
  const inc = r.find((x) => x.go === 'lista');
  assert.equal(inc.filter, 'incompletos');
  assert.equal(inc.text, 'Prado');
});

test('resumoCompetencia conta lançadas e as que ainda não foram pagas', () => {
  const base = baseVazia({
    alojamentos: [aloj({ contas_controladas: ['Aluguel', 'Água', 'Gás'] })],
    pagamentos: [
      { alojamento_id: 'a1', conta: 'Aluguel', competencia: '2026-11', status: 'pago' },
      { alojamento_id: 'a1', conta: 'Água', competencia: '2026-11', status: 'pendente' },
    ],
  });
  assert.deepEqual(resumoCompetencia(base, '2026-11', HOJE), { exp: 3, lanc: 2, pend: 1 });
});

test('resumoCelula: pago sem valor, soma de lançamentos e pendente com vencimento', () => {
  assert.deepEqual(resumoCelula([{ status: 'pago', valor: null }]), { st: 'pago', principal: '✓ pago', sub: '' });
  const soma = resumoCelula([
    { status: 'pago', valor: 100, data_pagamento: '2026-11-09' },
    { status: 'pago', valor: 50.5 },
  ]);
  assert.equal(soma.principal, '150,50');
  assert.equal(soma.sub, 'dia 9');
  assert.deepEqual(resumoCelula([{ status: 'pendente', valor: null, vencimento: '2026-11-10' }]), { st: 'pendente', principal: 'Pendente', sub: 'vence 10/11' });
  assert.equal(resumoCelula([{ status: 'agendado', valor: null }]).st, 'agendado');
});

test('movimentos ordena do mais recente e ignora estadia de alojamento desconhecido', () => {
  const base = baseVazia({
    alojamentos: [aloj()],
    estadias: [
      { alojamento_id: 'a1', morador: 'Ana', entrada: '2026-01-01', saida: '2026-03-01' },
      { alojamento_id: 'a1', morador: 'Bia', entrada: '2026-02-01' },
      { alojamento_id: 'x', morador: 'Cid', entrada: '2026-05-01' },
    ],
  });
  assert.deepEqual(movimentos(base).map((m) => `${m.t} ${m.e.morador}`), ['Saída Ana', 'Entrada Bia', 'Entrada Ana']);
});

test('alojs ordena por situação e depois por nome', () => {
  const base = baseVazia({
    alojamentos: [aloj({ id: '1', nome: 'Z', status: 'inativo' }), aloj({ id: '2', nome: 'B' }), aloj({ id: '3', nome: 'A', status: 'desmobilizacao' }), aloj({ id: '4', nome: 'Á' })],
  });
  assert.deepEqual(alojs(base).map((a) => a.id), ['4', '2', '3', '1']);
});

test('auxiliares de competência, iniciais e local', () => {
  assert.equal(addMonths('2026-12', 1), '2027-01');
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(compLabel('2026-03'), 'Mar/2026');
  assert.equal(initials('Buritis Aluísio 202'), 'BA');
  assert.equal(local({ cidade: 'BH', uf: 'MG' }), 'BH · MG');
  assert.equal(local({ pais: 'México' }), 'México');
  assert.equal(local({ pais: 'Brasil' }), 'Local não informado');
});
