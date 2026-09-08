import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MOVIMENTOS, eDesmobilizacao, inicialMobilizacao, aoTrocarMovimento, validarMobilizacao,
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
  contato_cliente: 'Sicrano',
});

test('as três situações vivem no mesmo seletor', () => {
  assert.deepEqual(MOVIMENTOS, ['Nova mobilização', 'Movimentação de profissional', 'Desmobilização']);
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
  assert.equal(v.contato_cliente, '');
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

// A cadeia de exigencias tem DOIS donos: `projeto` veio do Administrativo e
// `cliente` veio do modulo de Mobilizacao, que nasce deste chamado. O teste
// cobre a ordem inteira de proposito — foi ela que conflitou no merge, e uma
// ordem errada faz a tela cobrar o campo errado.
test('mobilização exige profissional, cliente, CC, projeto, obra e data', () => {
  const mob = (extra) => validarMobilizacao({ movimento: 'Nova mobilização', profissional_id: 'p1', ...extra });
  const comCliente = { cliente: 'IMC SASTE' };
  assert.match(validarMobilizacao(inicialMobilizacao()), /profissional/i);
  assert.match(mob({}), /cliente/i);
  assert.match(mob(comCliente), /centro de custo/i);
  assert.match(mob({ ...comCliente, cc: 'x' }), /projeto/i);
  assert.match(mob({ ...comCliente, cc: 'x', projeto: 'Obra Norte' }), /obra/i);
  assert.match(mob({ ...comCliente, cc: 'x', projeto: 'Obra Norte', local_obra: 'y' }), /data/i);
  assert.equal(validarMobilizacao(mobilizacaoCheia()), '');
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
