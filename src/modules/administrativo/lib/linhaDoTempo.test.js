import test from 'node:test';
import assert from 'node:assert/strict';
import { textoDoEvento, montarLinhaDoTempo } from './linhaDoTempo.js';

const NOMES = { u1: 'Marcus', u2: 'Paulo Ricardo', u3: 'Jarbas' };
const ev = (over) => ({ tipo: 'status', autor_id: 'u1', de: null, para: null, dados: {}, ...over });

test('abertura e atribuição citam as pessoas certas', () => {
  assert.equal(textoDoEvento(ev({ tipo: 'criado', autor_id: 'u3', para: 'aberto' }), NOMES),
    'Chamado aberto por Jarbas');
  assert.equal(textoDoEvento(ev({ tipo: 'atribuido', autor_id: 'u1', para: 'u2' }), NOMES),
    'Atribuído a Paulo Ricardo');
  assert.equal(textoDoEvento(ev({ tipo: 'atribuido', autor_id: 'u1', para: null }), NOMES),
    'Responsável removido por Marcus');
});

// O par (de → para) é o que distingue reabertura de fechamento e liberação de
// "status alterado". Olhar só o destino perderia isso.
test('reabertura é reconhecida por vir de fechado', () => {
  assert.equal(textoDoEvento(ev({ de: 'fechado', para: 'aberto', autor_id: 'u3' }), NOMES),
    'Chamado reaberto por Jarbas');
});

test('saída da aprovação vira liberação, não "status alterado"', () => {
  assert.equal(textoDoEvento(ev({ de: 'aguardando_aprovacao', para: 'aberto' }), NOMES),
    'Aprovação concluída — liberado para atendimento');
});

test('estados de trabalho têm frase própria', () => {
  assert.equal(textoDoEvento(ev({ de: 'aberto', para: 'em_atendimento', autor_id: 'u2' }), NOMES),
    'Atendimento iniciado por Paulo Ricardo');
  assert.equal(textoDoEvento(ev({ de: 'em_atendimento', para: 'aguardando_solicitante' }), NOMES),
    'Aguardando resposta do solicitante');
  assert.equal(textoDoEvento(ev({ de: 'em_atendimento', para: 'fechado', autor_id: 'u2' }), NOMES),
    'Chamado fechado por Paulo Ricardo');
});

test('reprovação carrega o motivo — é o que o solicitante precisa ler', () => {
  const t = textoDoEvento(ev({ tipo: 'reprovado', autor_id: 'u1', dados: { justificativa: 'sem verba' } }), NOMES);
  assert.equal(t, 'Reprovado por Marcus — sem verba');
});

test('avaliação mostra a nota em estrelas, no singular e no plural', () => {
  assert.equal(textoDoEvento(ev({ tipo: 'avaliado', para: '5', autor_id: 'u3' }), NOMES),
    'Atendimento avaliado com 5 estrelas');
  assert.equal(textoDoEvento(ev({ tipo: 'avaliado', para: '1', autor_id: 'u3' }), NOMES),
    'Atendimento avaliado com 1 estrela');
});

// Autor nulo acontece em mudança feita fora de uma sessão (carga, correção).
test('sem autor, a frase não inventa nome', () => {
  assert.equal(textoDoEvento(ev({ tipo: 'criado', autor_id: null }), NOMES), 'Chamado aberto');
});

test('mescla em ordem cronológica', () => {
  const linha = montarLinhaDoTempo({
    eventos: [ev({ created_at: '2026-08-10T12:00:00Z', tipo: 'criado' })],
    mensagens: [
      { id: 'm1', created_at: '2026-08-10T14:00:00Z', mensagem: 'oi' },
      { id: 'm2', created_at: '2026-08-10T11:00:00Z', mensagem: 'antes' },
    ],
  });
  assert.deepEqual(linha.map((i) => i.tipo), ['mensagem', 'evento', 'mensagem']);
  assert.equal(linha[0].dado.id, 'm2');
});

// Responder muda o status no mesmo instante: ler "atendimento iniciado" e
// depois a resposta faz mais sentido que o contrário.
test('empate de horário coloca o evento antes da mensagem', () => {
  const em = '2026-08-10T12:00:00Z';
  const linha = montarLinhaDoTempo({
    mensagens: [{ id: 'm1', created_at: em }],
    eventos: [ev({ created_at: em })],
  });
  assert.deepEqual(linha.map((i) => i.tipo), ['evento', 'mensagem']);
});

test('lista vazia não quebra', () => {
  assert.deepEqual(montarLinhaDoTempo(), []);
  assert.deepEqual(montarLinhaDoTempo({ eventos: [], mensagens: [] }), []);
});
