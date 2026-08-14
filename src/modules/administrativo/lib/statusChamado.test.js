import test from 'node:test';
import assert from 'node:assert/strict';
import { proximoStatusAoResponder } from './statusChamado.js';

const resp = (o) => proximoStatusAoResponder(o);

test('Adm responde e a bola passa para o solicitante', () => {
  assert.equal(resp({ statusAtual: 'aberto', souSolicitante: false }), 'aguardando_solicitante');
  assert.equal(resp({ statusAtual: 'em_atendimento', souSolicitante: false }), 'aguardando_solicitante');
});

test('solicitante responde e a bola volta para o Adm', () => {
  assert.equal(resp({ statusAtual: 'aguardando_solicitante', souSolicitante: true }), 'em_atendimento');
  assert.equal(resp({ statusAtual: 'aberto', souSolicitante: true }), 'em_atendimento');
});

// Nota interna é conversa do Adm consigo mesmo — não é resposta a ninguém.
test('nota interna nunca muda o estado', () => {
  assert.equal(resp({ statusAtual: 'aberto', souSolicitante: false, interna: true }), null);
  assert.equal(resp({ statusAtual: 'em_atendimento', souSolicitante: false, interna: true }), null);
});

test('chamado encerrado ou em aprovação não muda por mensagem', () => {
  for (const s of ['fechado', 'reprovado', 'cancelado', 'aguardando_aprovacao']) {
    assert.equal(resp({ statusAtual: s, souSolicitante: false }), null, s);
    assert.equal(resp({ statusAtual: s, souSolicitante: true }), null, s);
  }
});

// Evita update inútil e, principalmente, um evento repetido na linha do tempo.
test('responder de novo no mesmo estado não gera mudança', () => {
  assert.equal(resp({ statusAtual: 'aguardando_solicitante', souSolicitante: false }), null);
  assert.equal(resp({ statusAtual: 'em_atendimento', souSolicitante: true }), null);
});
