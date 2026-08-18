import test from 'node:test';
import assert from 'node:assert/strict';
import { desdobrarMobilizacao, categoriaDoEquipamento, SEGUNDA_TELA } from './desdobramento.js';

const mob = (extra = {}) => ({
  movimento: 'Nova mobilização',
  profissional: 'JOAO DA SILVA',
  cc: 'CC-100',
  local_obra: 'Obra Norte',
  data_inicio_cliente: '2026-09-01',
  equipamentos: [], softwares: [], epis: [], uniforme: '',
  ...extra,
});

const doServico = (filhos, servico) => filhos.filter((f) => f.servico === servico);

test('mobilização sem adicionais não gera nada', () => {
  assert.deepEqual(desdobrarMobilizacao(mob()), []);
  assert.deepEqual(desdobrarMobilizacao({}), []);
});

// Toda a lista de equipamentos do portal é notebook; o serviço de TI só aceita
// categoria. Perder a especificação seria pedir "um notebook" sem dizer qual.
test('especificação da máquina vira categoria, e a original fica na observação', () => {
  const [f] = desdobrarMobilizacao(mob({ equipamentos: ['Gamer 32RAM + 1TB'] }));
  assert.equal(f.classe, 'ti');
  assert.equal(f.servico, 'solicitacao-equipamentos');
  assert.equal(f.campos.tipo, 'Notebook');
  assert.match(f.campos.observacao, /Gamer 32RAM \+ 1TB/);
});

test('a segunda tela é monitor, não notebook', () => {
  assert.equal(categoriaDoEquipamento(SEGUNDA_TELA), 'Monitor');
  assert.equal(categoriaDoEquipamento('Notebook Padrão'), 'Notebook');
});

// "Tipo" é de escolha única no serviço de TI: notebook e monitor no mesmo
// chamado obrigariam a escolher um e descartar o outro.
test('notebook e segunda tela saem em chamados separados', () => {
  const filhos = desdobrarMobilizacao(mob({
    equipamentos: ['Notebook Padrão', SEGUNDA_TELA],
  }));
  assert.equal(filhos.length, 2);
  assert.deepEqual(filhos.map((f) => f.campos.tipo).sort(), ['Monitor', 'Notebook']);
});

test('dois notebooks continuam num chamado só', () => {
  const filhos = desdobrarMobilizacao(mob({
    equipamentos: ['Notebook Padrão', 'Gamer 16RAM + 512SSD'],
  }));
  assert.equal(filhos.length, 1);
  assert.match(filhos[0].campos.observacao, /Notebook Padrão, Gamer 16RAM \+ 512SSD/);
});

test('cada software vira um chamado', () => {
  const filhos = doServico(
    desdobrarMobilizacao(mob({ softwares: ['MS Project', 'Power BI'] })),
    'instalacao-software',
  );
  assert.equal(filhos.length, 2);
  assert.deepEqual(filhos.map((f) => f.campos.software), ['MS Project', 'Power BI']);
});

// O campo "Homologado" é obrigatório no serviço; a lista vem do catálogo do DP.
test('software do catálogo é homologado, "Outra" não é', () => {
  const filhos = desdobrarMobilizacao(mob({ softwares: ['Power BI', 'Outra'] }));
  assert.equal(filhos[0].campos.homologado, 'sim');
  assert.equal(filhos[1].campos.homologado, 'nao');
});

test('EPIs saem num chamado só, com a lista inteira', () => {
  const [f] = doServico(desdobrarMobilizacao(mob({ epis: ['Capacete', 'Botina com metatarso'] })), 'epi');
  assert.deepEqual(f.campos.tipo, ['Capacete', 'Botina com metatarso']);
  assert.equal(f.campos.motivo, 'Item novo');
});

test('uniforme em branco não gera chamado; com texto, gera', () => {
  assert.equal(doServico(desdobrarMobilizacao(mob({ uniforme: '   ' })), 'uniforme').length, 0);
  const [f] = doServico(desdobrarMobilizacao(mob({ uniforme: 'Camisa P, calça 42' })), 'uniforme');
  assert.equal(f.campos.tipo_livre, 'Camisa P, calça 42');
});

// Sem isso, quem recebe o pedido de EPI não sabe para quem é nem em qual obra.
test('centro de custo, obra e data descem para os filhos', () => {
  const filhos = desdobrarMobilizacao(mob({
    equipamentos: ['Notebook Padrão'], epis: ['Capacete'],
  }));
  for (const f of filhos) {
    assert.equal(f.campos.cc, 'CC-100');
    assert.equal(f.campos.localizacao, 'Obra Norte');
    assert.match(f.campos.observacao, /JOAO DA SILVA/);
  }
  assert.equal(doServico(filhos, 'solicitacao-equipamentos')[0].campos.data_necessidade, '2026-09-01');
});

test('sem nome do profissional, o texto não fica quebrado', () => {
  const [f] = desdobrarMobilizacao({ equipamentos: ['Notebook Padrão'] });
  assert.match(f.campos.observacao, /profissional mobilizado/);
});

// A desmobilização zera os adicionais ao trocar de movimento (mobilizacao.js),
// então não há o que desdobrar — e nada aqui pode ressuscitá-los.
test('desmobilização não gera filhos', () => {
  const filhos = desdobrarMobilizacao({
    movimento: 'Desmobilização', profissional: 'JOAO', devolucao: true,
    equipamentos: [], softwares: [], epis: [], uniforme: '',
  });
  assert.deepEqual(filhos, []);
});

test('uma mobilização completa gera um chamado de cada frente', () => {
  const filhos = desdobrarMobilizacao(mob({
    equipamentos: ['Notebook Padrão'], softwares: ['Power BI'],
    epis: ['Capacete'], uniforme: 'Camisa M',
  }));
  assert.deepEqual(
    filhos.map((f) => `${f.classe}/${f.servico}`),
    ['ti/solicitacao-equipamentos', 'ti/instalacao-software', 'saude-seguranca/epi', 'saude-seguranca/uniforme'],
  );
});
