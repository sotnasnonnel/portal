import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resumoIndicadores, fechouNoPrazo, estaAtrasado, estaAberto, filtrarPorArea, diasDeAtendimento,
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
  // tempoMedio/medidos entraram com o pedido de tempo médio por tipo: nenhum
  // destes foi FECHADO (um está aberto, o outro reprovado), então não há média.
  assert.deepEqual(r.porServico[0], {
    nome: 'Uber', abertos: 1, encerrados: 1, total: 2, tempoMedio: null, medidos: 0,
  });
});

test('lista vazia não quebra nem inventa número', () => {
  const r = resumoIndicadores([], AGORA);
  assert.equal(r.total, 0);
  assert.equal(r.abertos, 0);
  assert.equal(r.atrasados, 0);
  assert.deepEqual(r.abertosPorClasse, []);
  assert.deepEqual(r.porServico, []);
});


// A lista que o painel abre no clique e o número do cartão têm de contar o
// mesmo: dois cálculos separados divergiriam na primeira mudança de regra.
test('listaAtrasados casa com o número e vem do mais vencido para o menos', () => {
  const r = resumoIndicadores([
    ch({ id: 1, status: 'aberto', sla_vence_em: iso(AGORA - DIA) }),
    ch({ id: 2, status: 'em_atendimento', sla_vence_em: iso(AGORA - 3 * DIA) }),
    ch({ id: 3, status: 'aberto', sla_vence_em: iso(AGORA + DIA) }),
    ch({ id: 4, status: 'fechado', sla_vence_em: iso(AGORA - 5 * DIA), fechado_em: iso(AGORA) }),
  ], AGORA);
  assert.equal(r.atrasados, 2);
  assert.equal(r.listaAtrasados.length, r.atrasados);
  assert.deepEqual(r.listaAtrasados.map((c) => c.id), [2, 1]);
});

test('filtrarPorArea separa TI do resto, e "todos" não filtra nada', () => {
  const lista = [
    { classe: 'ti', servico: 'instalacao-software' },
    { classe: 'ti', servico: 'verificacoes' },
    { classe: 'frota', servico: 'abastecimento' },
    { classe: 'saude-seguranca', servico: 'uniforme' },
  ];
  assert.equal(filtrarPorArea(lista, 'ti').length, 2);
  assert.equal(filtrarPorArea(lista, 'adm').length, 2);
  assert.equal(filtrarPorArea(lista, 'todos').length, 4);
  assert.equal(filtrarPorArea(lista).length, 4);
});

// A régua é a classe: serviço novo dentro de TI entra na conta sem ninguém
// mexer no código.
test('filtrarPorArea reconhece serviço novo de TI pela classe', () => {
  const lista = [{ classe: 'ti', servico: 'servico-que-ainda-nao-existe' }];
  assert.equal(filtrarPorArea(lista, 'ti').length, 1);
  assert.equal(filtrarPorArea(lista, 'adm').length, 0);
});

const fechado = (extra = {}) => ({
  status: 'fechado', classe: 'ti', servico: 'instalacao-software',
  criado_em: '2026-09-01T09:00:00Z', fechado_em: '2026-09-04T09:00:00Z', ...extra,
});

test('diasDeAtendimento conta da entrada na fila até o fechamento', () => {
  assert.equal(diasDeAtendimento(fechado()), 3);
});

// Com alçada, o relógio do time começa na liberação: o tempo parado na mesa do
// gerente não é tempo de atendimento.
test('diasDeAtendimento parte da análise quando houve aprovação', () => {
  assert.equal(diasDeAtendimento(fechado({ analise_em: '2026-09-03T09:00:00Z' })), 1);
});

test('só chamado fechado tem tempo de atendimento', () => {
  assert.equal(diasDeAtendimento(fechado({ status: 'aberto', fechado_em: null })), null);
  assert.equal(diasDeAtendimento(fechado({ status: 'reprovado' })), null);
  assert.equal(diasDeAtendimento(null), null);
});

test('porServico traz o tempo médio e quantos entraram na conta', () => {
  const r = resumoIndicadores([
    fechado({ servicoLabel: 'Instalação de software' }),
    fechado({ servicoLabel: 'Instalação de software', fechado_em: '2026-09-06T09:00:00Z' }),
    { status: 'aberto', servicoLabel: 'Instalação de software', criado_em: '2026-09-01T09:00:00Z' },
  ], AGORA);
  const linha = r.porServico.find((s) => s.nome === 'Instalação de software');
  assert.equal(linha.total, 3);
  assert.equal(linha.tempoMedio, 4);   // (3 + 5) / 2
  assert.equal(linha.medidos, 2);
});

test('serviço sem nenhum fechado não inventa média', () => {
  const r = resumoIndicadores([
    { status: 'aberto', servicoLabel: 'Verificações', criado_em: '2026-09-01T09:00:00Z' },
  ], AGORA);
  assert.equal(r.porServico[0].tempoMedio, null);
  assert.equal(r.porServico[0].medidos, 0);
});

test('o tempo médio por serviço arredonda para cima', () => {
  const r = resumoIndicadores([
    fechado({ servicoLabel: 'Uber TI' }),                                    // 3 dias
    fechado({ servicoLabel: 'Uber TI', fechado_em: '2026-09-05T09:00:00Z' }), // 4 dias
  ], AGORA);
  // (3 + 4) / 2 = 3,5
  assert.equal(r.porServico.find((s) => s.nome === 'Uber TI').tempoMedio, 4);
});

// Chamado resolvido em horas não pode aparecer como "0 d".
test('menos de um dia conta como um dia', () => {
  const r = resumoIndicadores([
    fechado({ servicoLabel: 'Rapidinho', fechado_em: '2026-09-01T13:00:00Z' }),
  ], AGORA);
  assert.equal(r.porServico[0].tempoMedio, 1);
});
