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

// O cliente entrou na lista quando o modulo de Mobilizacao passou a nascer
// deste chamado: sem ele o processo nascia com o cliente em branco, enquanto
// as 125 linhas vindas da planilha tinham todos preenchidos.
test('mobilização exige profissional, cliente, CC, obra e data', () => {
  const mob = (extra) => validarMobilizacao({ movimento: 'Nova mobilização', profissional_id: 'p1', ...extra });
  assert.match(validarMobilizacao(inicialMobilizacao()), /profissional/i);
  assert.match(mob({}), /cliente/i);
  assert.match(mob({ cliente: 'IMC SASTE' }), /centro de custo/i);
  assert.match(mob({ cliente: 'IMC SASTE', cc: 'x' }), /obra/i);
  assert.match(mob({ cliente: 'IMC SASTE', cc: 'x', local_obra: 'y' }), /data/i);
  assert.equal(validarMobilizacao(mobilizacaoCheia()), '');
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
