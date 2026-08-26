import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resumoIndicadores, fechouNoPrazo, estaAtrasado, estaAberto,
} from './indicadores.js';

const DIA = 24 * 3600 * 1000;
const AGORA = new Date('2026-08-20T12:00:00Z').getTime();
const iso = (ms) => new Date(ms).toISOString();

const ch = (extra = {}) => ({
  status: 'aberto', classe: 'ti', servico: 'liberacao-acessos',
  criado_em: iso(AGORA - 5 * DIA), fechado_em: null, sla_vence_em: iso(AGORA + DIA),
  ...extra,
});

test('aguardando aprovação ainda é chamado aberto', () => {
  for (const s of ['aguardando_aprovacao', 'aberto', 'em_atendimento', 'aguardando_solicitante']) {
    assert.equal(estaAberto({ status: s }), true, s);
  }
  for (const s of ['fechado', 'reprovado', 'cancelado']) {
    assert.equal(estaAberto({ status: s }), false, s);
  }
});

// ---- SLA ----

test('fechou antes do prazo conta como no prazo', () => {
  assert.equal(fechouNoPrazo(ch({
    status: 'fechado', fechado_em: iso(AGORA), sla_vence_em: iso(AGORA + DIA),
  })), true);
});

test('fechou depois do prazo conta como fora', () => {
  assert.equal(fechouNoPrazo(ch({
    status: 'fechado', fechado_em: iso(AGORA), sla_vence_em: iso(AGORA - DIA),
  })), false);
});

// Serviço sem prazo configurado não pode inflar o indicador: contar como
// cumprido esconderia justamente a lacuna de cadastro.
test('fechado sem prazo definido não vira "no prazo"', () => {
  assert.equal(fechouNoPrazo(ch({
    status: 'fechado', fechado_em: iso(AGORA), sla_vence_em: null,
  })), null);
});

test('chamado ainda aberto não tem veredito de SLA', () => {
  assert.equal(fechouNoPrazo(ch()), null);
});

test('o percentual sai só sobre os que dá para julgar', () => {
  const r = resumoIndicadores([
    ch({ status: 'fechado', fechado_em: iso(AGORA), sla_vence_em: iso(AGORA + DIA) }),
    ch({ status: 'fechado', fechado_em: iso(AGORA), sla_vence_em: iso(AGORA - DIA) }),
    ch({ status: 'fechado', fechado_em: iso(AGORA), sla_vence_em: null }),
  ], AGORA);
  assert.equal(r.sla.noPrazo, 1);
  assert.equal(r.sla.fora, 1);
  assert.equal(r.sla.semPrazo, 1);
  assert.equal(r.sla.medidos, 2);
  assert.equal(r.sla.pct, 50);
});

// Sem nada medido, o indicador é nulo — 0% diria "ninguém cumpriu o prazo".
test('sem chamado medido, o percentual é nulo e não zero', () => {
  assert.equal(resumoIndicadores([], AGORA).sla.pct, null);
  assert.equal(resumoIndicadores([ch()], AGORA).sla.pct, null);
});

// ---- atraso ----

test('atrasado é só o que está em jogo e passou do prazo', () => {
  assert.equal(estaAtrasado(ch({ sla_vence_em: iso(AGORA - DIA) }), AGORA), true);
  assert.equal(estaAtrasado(ch({ sla_vence_em: iso(AGORA + DIA) }), AGORA), false);
});

// Fechado com atraso já aparece no indicador de SLA; contá-lo aqui de novo
// somaria o mesmo problema duas vezes no painel.
test('fechado fora do prazo não conta como atrasado', () => {
  assert.equal(estaAtrasado(ch({
    status: 'fechado', fechado_em: iso(AGORA), sla_vence_em: iso(AGORA - DIA),
  }), AGORA), false);
});

test('chamado sem prazo nunca está atrasado', () => {
  assert.equal(estaAtrasado(ch({ sla_vence_em: null }), AGORA), false);
});

// ---- agregações ----

// Reprovado conta como fechado no painel: para quem pediu, um pedido negado
// está tão concluído quanto um atendido.
test('conta abertos e encerrados sem se confundir', () => {
  const r = resumoIndicadores([
    ch(), ch({ status: 'em_atendimento' }),
    ch({ status: 'fechado', fechado_em: iso(AGORA) }),
    ch({ status: 'reprovado' }), ch({ status: 'cancelado' }),
  ], AGORA);
  assert.equal(r.total, 5);
  assert.equal(r.abertos, 2);
  assert.equal(r.encerrados, 3);
  assert.equal(r.atendidos, 1);
  assert.equal(r.reprovados, 1);
});

// Reprovado nunca chegou ao atendimento: julgá-lo por prazo não diria nada, e
// contá-lo como "fora do prazo" puniria o time por uma decisão do aprovador.
test('reprovado não entra na conta de SLA', () => {
  const r = resumoIndicadores([
    ch({ status: 'reprovado', sla_vence_em: iso(AGORA - DIA) }),
    ch({ status: 'fechado', fechado_em: iso(AGORA), sla_vence_em: iso(AGORA + DIA) }),
  ], AGORA);
  assert.equal(r.encerrados, 2);
  assert.equal(r.sla.medidos, 1);
  assert.equal(r.sla.pct, 100);
});

test('abertos por classe usa o rótulo quando existe e vem do maior', () => {
  const r = resumoIndicadores([
    ch({ classeLabel: 'TI' }), ch({ classeLabel: 'TI' }),
    ch({ classeLabel: 'Frota' }),
  ], AGORA);
  assert.deepEqual(r.abertosPorClasse, [
    { nome: 'TI', total: 2 }, { nome: 'Frota', total: 1 },
  ]);
});

// Só os abertos entram no gráfico por classe: misturar fechados mostraria
// volume histórico onde a tela promete trabalho pendente.
test('classe conta só o que está aberto', () => {
  const r = resumoIndicadores([
    ch({ classeLabel: 'TI' }),
    ch({ classeLabel: 'TI', status: 'fechado', fechado_em: iso(AGORA) }),
  ], AGORA);
  assert.deepEqual(r.abertosPorClasse, [{ nome: 'TI', total: 1 }]);
});

test('por serviço soma abertos e encerrados na mesma linha', () => {
  const r = resumoIndicadores([
    ch({ servicoLabel: 'Uber' }),
    ch({ servicoLabel: 'Uber', status: 'reprovado' }),
    ch({ servicoLabel: 'EPI' }),
  ], AGORA);
  assert.deepEqual(r.porServico[0], { nome: 'Uber', abertos: 1, encerrados: 1, total: 2 });
});

test('lista vazia não quebra nem inventa número', () => {
  const r = resumoIndicadores([], AGORA);
  assert.equal(r.total, 0);
  assert.equal(r.abertos, 0);
  assert.equal(r.atrasados, 0);
  assert.deepEqual(r.abertosPorClasse, []);
  assert.deepEqual(r.porServico, []);
});
