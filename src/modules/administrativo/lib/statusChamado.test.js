import test from 'node:test';
import assert from 'node:assert/strict';
import { proximoStatusAoResponder, etapaQueEsperaPorMim } from './statusChamado.js';

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

test('etapaQueEsperaPorMim: a vez é da menor ordem pendente', () => {
  const etapas = [
    { id: 'e1', ordem: 1, status: 'aprovada', aprovador_id: 'tulio' },
    { id: 'e2', ordem: 2, status: 'pendente', aprovador_id: 'leo' },
  ];
  assert.equal(etapaQueEsperaPorMim(etapas, 'leo', 'aguardando_aprovacao')?.id, 'e2');
  assert.equal(etapaQueEsperaPorMim(etapas, 'tulio', 'aguardando_aprovacao'), null);
});

// Sem isto, o segundo da cadeia decidiria antes do primeiro.
test('etapaQueEsperaPorMim: quem vem depois ainda não decide', () => {
  const etapas = [
    { id: 'e1', ordem: 1, status: 'pendente', aprovador_id: 'tulio' },
    { id: 'e2', ordem: 2, status: 'pendente', aprovador_id: 'leo' },
  ];
  assert.equal(etapaQueEsperaPorMim(etapas, 'leo', 'aguardando_aprovacao'), null);
});

test('etapaQueEsperaPorMim: chamado que já saiu da aprovação não pede decisão', () => {
  const etapas = [{ id: 'e1', ordem: 1, status: 'pendente', aprovador_id: 'leo' }];
  assert.equal(etapaQueEsperaPorMim(etapas, 'leo', 'aberto'), null);
  assert.equal(etapaQueEsperaPorMim(etapas, null, 'aguardando_aprovacao'), null);
});
