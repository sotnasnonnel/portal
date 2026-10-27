import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MOVIMENTOS, eDesmobilizacao, inicialMobilizacao, aoTrocarMovimento, validarMobilizacao,
  desmobDaMovimentacao,
} from './mobilizacao.js';

const mobilizacaoCheia = () => ({
  ...inicialMobilizacao(),
  profissional_id: 'p1',
  profissional: 'Fulano',
  gestor: 'Beltrano',
  cliente: 'IMC SASTE',
  cliente_final: 'VALE',
  empresa_phd: 'PHD ASSESSORIA',
  cc: 'CC-100',
  projeto_id: 'proj-1',
  projeto: 'Obra Norte',
  local_obra: 'Obra X',
  data_inicio_cliente: '2026-09-01',
  epis: ['Capacete'],
  uniforme: '2 camisas polo M',
  contato_nome: 'Sicrano',
  contato_telefone: '(31) 9 9999-9999',
  contato_email: 'sicrano@cliente.com.br',
});

test('as quatro situações vivem no mesmo seletor', () => {
  assert.deepEqual(MOVIMENTOS, [
    'Nova mobilização', 'Movimentação de profissional', 'Desmobilização', 'Inclusão de treinamento',
  ]);
});

// O motivo de existir aoTrocarMovimento: sem ela, obra e CC preenchidos
// viajariam escondidos num chamado de desmobilização.
test('trocar para desmobilização descarta os campos que não se aplicam', () => {
  const v = aoTrocarMovimento(mobilizacaoCheia(), 'Desmobilização');
  assert.equal(v.cc, '');
  assert.equal(v.projeto, '', 'projeto é da mobilização, não de quem sai');
  assert.equal(v.projeto_id, '');
  assert.equal(v.local_obra, '');
  assert.equal(v.data_inicio_cliente, '');
  assert.deepEqual(v.epis, []);
  assert.equal(v.uniforme, '', 'uniforme é texto livre e também precisa ser limpo');
  assert.equal(v.contato_nome, '');
  assert.equal(v.contato_telefone, '');
  assert.equal(v.contato_email, '');
  assert.equal(v.profissional_id, 'p1', 'o profissional escolhido continua valendo');
});

test('voltar para mobilização descarta a devolução', () => {
  const desmob = { ...aoTrocarMovimento(mobilizacaoCheia(), 'Desmobilização'), devolucao: true, devolucao_descricao: 'notebook' };
  const v = aoTrocarMovimento(desmob, 'Nova mobilização');
  assert.equal(v.devolucao, false);
  assert.equal(v.devolucao_descricao, '');
});

test('eDesmobilizacao distingue o ramo', () => {
  assert.equal(eDesmobilizacao({ movimento: 'Desmobilização' }), true);
  assert.equal(eDesmobilizacao({ movimento: 'Nova mobilização' }), false);
});

// A cadeia de exigencias tem DOIS donos: `projeto` veio do Atendimento e
// `cliente` veio do modulo de Mobilizacao, que nasce deste chamado. O teste
// cobre a ordem inteira de proposito — foi ela que conflitou no merge, e uma
// ordem errada faz a tela cobrar o campo errado.
// Mesma ordem da tela: o projeto vem logo depois do profissional (27/10/2026).
test('mobilização exige profissional, projeto, cliente, CC, obra e data', () => {
  const mob = (extra) => validarMobilizacao({ movimento: 'Nova mobilização', profissional_id: 'p1', ...extra });
  const comProjeto = { projeto: 'GERD-CT14-PIND' };
  assert.match(validarMobilizacao(inicialMobilizacao()), /profissional/i);
  assert.match(mob({}), /projeto/i);
  assert.match(mob(comProjeto), /cliente/i);
  assert.match(mob({ ...comProjeto, cliente: 'GERDAU' }), /centro de custo/i);
  assert.match(mob({ ...comProjeto, cliente: 'GERDAU', cc: 'x' }), /obra/i);
  assert.match(mob({ ...comProjeto, cliente: 'GERDAU', cc: 'x', local_obra: 'y' }), /data/i);
  assert.equal(validarMobilizacao(mobilizacaoCheia()), '');
});

// Nome, telefone e e-mail do contato no cliente: os três obrigatórios (27/10/2026).
test('mobilização e movimentação cobram o contato completo no cliente', () => {
  for (const movimento of ['Nova mobilização', 'Movimentação de profissional']) {
    // precisa_desmob: a movimentação também pergunta da saída (27/10/2026).
    const v = { ...mobilizacaoCheia(), movimento, precisa_desmob: 'nao' };
    assert.equal(validarMobilizacao(v), '');
    assert.match(validarMobilizacao({ ...v, contato_nome: ' ' }), /nome do contato/i);
    assert.match(validarMobilizacao({ ...v, contato_telefone: '(31) 9999' }), /telefone/i, 'sem DDD ou incompleto');
    assert.equal(validarMobilizacao({ ...v, contato_telefone: '3133334444' }), '', 'fixo sem máscara vale');
    assert.match(validarMobilizacao({ ...v, contato_email: 'sicrano@cliente' }), /e-mail/i);
    assert.match(validarMobilizacao({ ...v, contato_email: '' }), /e-mail/i);
  }
});

test('desmobilização não cobra contato', () => {
  assert.equal(validarMobilizacao({ movimento: 'Desmobilização', profissional_id: 'p1', data_desmobilizacao: '2026-09-30' }), '');
});

// O nome digitado vale tanto quanto o escolhido da lista: obra recém-fechada
// ainda não está cadastrada, e travar a mobilização por isso seria pior.
test('projeto fora da lista passa pela validação com o nome digitado', () => {
  const v = { ...mobilizacaoCheia(), projeto_id: 'outro', projeto: 'Obra que não está no portal' };
  assert.equal(validarMobilizacao(v), '');
  assert.match(validarMobilizacao({ ...v, projeto: '   ' }), /projeto/i);
});

// Desmobilização não pode herdar as exigências da mobilização: nada de CC,
// obra ou data de início. O que ela cobra é a data em que a pessoa SAI, que é
// a data-base do processo de desmobilização — sem ela nenhum passo tem prazo.
test('desmobilização cobra profissional, data de saída e o que devolve', () => {
  const desmob = (extra) => validarMobilizacao({ movimento: 'Desmobilização', profissional_id: 'p1', ...extra });

  assert.match(desmob({}), /data da desmobiliza/i);
  assert.equal(desmob({ data_desmobilizacao: '2026-09-30' }), '');

  assert.match(
    desmob({ data_desmobilizacao: '2026-09-30', devolucao: true, devolucao_descricao: '  ' }),
    /devolvido/i,
  );
  assert.equal(
    desmob({ data_desmobilizacao: '2026-09-30', devolucao: true, devolucao_descricao: 'notebook' }),
    '',
  );
});

// A desmobilizacao nao pode passar a exigir o que e da mobilizacao.
test('desmobilização não cobra CC, obra nem data de início', () => {
  const erro = validarMobilizacao({ movimento: 'Desmobilização', profissional_id: 'p1', data_desmobilizacao: '2026-09-30' });
  assert.equal(erro, '');
});

test('inclusão de treinamento pede quem, cliente, CC e quais treinamentos', () => {
  const base = {
    ...inicialMobilizacao(), movimento: 'Inclusão de treinamento',
    profissional_id: 'p1', cliente: 'VBM', cc: 'VBM-CT01',
  };
  assert.equal(validarMobilizacao(base), 'Informe quais treinamentos devem ser incluídos.');
  const contato = {
    contato_nome: 'Sicrano', contato_telefone: '(31) 3333-4444', contato_email: 's@vbm.com',
  };
  assert.match(validarMobilizacao({ ...base, treinamentos: 'RAC 04 e PRO' }), /nome do contato/i);
  assert.equal(validarMobilizacao({ ...base, ...contato, treinamentos: 'RAC 04 e PRO' }), '', 'sem projeto, obra nem data');
});

test('trocar para inclusão de treinamento limpa projeto, data e adicionais', () => {
  const antes = {
    ...inicialMobilizacao(), projeto: 'X', data_inicio_cliente: '2026-10-01', epis: ['Capacete'], cliente: 'VBM',
  };
  const depois = aoTrocarMovimento(antes, 'Inclusão de treinamento');
  assert.equal(depois.projeto, '');
  assert.equal(depois.data_inicio_cliente, '');
  assert.deepEqual(depois.epis, []);
  assert.equal(depois.cliente, 'VBM', 'o que serve continua');
  assert.equal(aoTrocarMovimento({ ...depois, treinamentos: 'RAC' }, 'Nova mobilização').treinamentos, '');
});

// Movimentação com saída (27/10/2026).
const movimentacaoCheia = () => ({ ...mobilizacaoCheia(), movimento: 'Movimentação de profissional' });

test('movimentação pergunta se precisa de desmobilização, e só então data e crachá', () => {
  const v = movimentacaoCheia();
  assert.match(validarMobilizacao(v), /desmobiliza/i);
  assert.equal(validarMobilizacao({ ...v, precisa_desmob: 'nao' }), '');
  const sim = { ...v, precisa_desmob: 'sim' };
  assert.match(validarMobilizacao(sim), /data da desmobiliza/i);
  assert.match(validarMobilizacao({ ...sim, desmob_data: '2026-11-03' }), /possui crachá/i);
  assert.equal(validarMobilizacao({ ...sim, desmob_data: '2026-11-03', desmob_possui_cracha: 'nao' }), '');
  assert.match(
    validarMobilizacao({ ...sim, desmob_data: '2026-11-03', desmob_possui_cracha: 'sim' }),
    /entregue ao cliente/i,
  );
  assert.equal(
    validarMobilizacao({ ...sim, desmob_data: '2026-11-03', desmob_possui_cracha: 'sim', desmob_cracha_entregue: 'nao' }),
    '',
  );
});

test('nova mobilização não pergunta sobre desmobilização', () => {
  assert.equal(validarMobilizacao(mobilizacaoCheia()), '');
});

test('sair da movimentação limpa as respostas da desmobilização', () => {
  const v = { ...movimentacaoCheia(), precisa_desmob: 'sim', desmob_data: '2026-11-03', desmob_possui_cracha: 'sim' };
  const nova = aoTrocarMovimento(v, 'Nova mobilização');
  assert.equal(nova.precisa_desmob, '');
  assert.equal(nova.desmob_data, '');
  assert.equal(nova.desmob_possui_cracha, '');
  assert.equal(aoTrocarMovimento(v, 'Movimentação de profissional').desmob_data, '2026-11-03', 'ficar não apaga');
});

// Obra, cliente e contato NÃO vão: o banco herda da obra de onde a pessoa sai.
test('o chamado de desmobilização leva só quem sai, quando e o crachá', () => {
  const v = {
    ...movimentacaoCheia(), precisa_desmob: 'sim', desmob_data: '2026-11-03',
    desmob_possui_cracha: 'nao', desmob_cracha_entregue: 'sim',
  };
  const d = desmobDaMovimentacao(v, 401);
  assert.equal(d.movimento, 'Desmobilização');
  assert.equal(d.profissional_id, 'p1');
  assert.equal(d.data_desmobilizacao, '2026-11-03');
  assert.equal(d.possui_cracha, 'nao');
  assert.equal(d.cracha_entregue, '', 'sem crachá não há entrega');
  assert.equal(d.movimentacao_numero, '401');
  assert.equal(d.local_obra, undefined);
  assert.equal(d.cliente, undefined);
  assert.equal(d.contato_nome, undefined);
  assert.equal(validarMobilizacao(d), '', 'passa na validação da desmobilização');
});
