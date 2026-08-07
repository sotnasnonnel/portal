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
  cc: 'CC-100',
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

test('mobilização exige profissional, CC, obra e data', () => {
  assert.match(validarMobilizacao(inicialMobilizacao()), /profissional/i);
  assert.match(validarMobilizacao({ movimento: 'Nova mobilização', profissional_id: 'p1' }), /centro de custo/i);
  assert.match(validarMobilizacao({ movimento: 'Nova mobilização', profissional_id: 'p1', cc: 'x' }), /obra/i);
  assert.match(validarMobilizacao({ movimento: 'Nova mobilização', profissional_id: 'p1', cc: 'x', local_obra: 'y' }), /data/i);
  assert.equal(validarMobilizacao(mobilizacaoCheia()), '');
});

// Desmobilização não pode herdar as exigências da mobilização.
test('desmobilização cobra só profissional e o que devolve', () => {
  assert.equal(validarMobilizacao({ movimento: 'Desmobilização', profissional_id: 'p1' }), '');
  assert.match(
    validarMobilizacao({ movimento: 'Desmobilização', profissional_id: 'p1', devolucao: true, devolucao_descricao: '  ' }),
    /devolvido/i,
  );
  assert.equal(
    validarMobilizacao({ movimento: 'Desmobilização', profissional_id: 'p1', devolucao: true, devolucao_descricao: 'notebook' }),
    '',
  );
});
