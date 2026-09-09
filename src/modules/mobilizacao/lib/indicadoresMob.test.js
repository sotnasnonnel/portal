import test from 'node:test';
import assert from 'node:assert/strict';
import {
  estaAtrasada, concluiuNoPrazo, resumoIndicadores, gargalosPorEtapa, faixaPct, formatarPct, etapasVencidas, processosTravados, etapaTravada, etapaAberta,
} from './indicadoresMob.js';

const et = (over = {}) => ({
  processo_id: 'p1', titulo: 'Exames', status: 'pendente',
  dias_atraso: null, responsavel_id: 'r1', responsavelNome: 'Ivone',
  fluxo: 'mobilizacao_pessoa', ...over,
});

test('atrasada é só o que ainda está em jogo', () => {
  assert.equal(estaAtrasada(et({ status: 'pendente', dias_atraso: 3 })), true);
  assert.equal(estaAtrasada(et({ status: 'em_andamento', dias_atraso: 1 })), true);
  assert.equal(estaAtrasada(et({ status: 'concluida', dias_atraso: 9 })), false,
    'concluída com atraso já entra no cumprimento de prazo');
  assert.equal(estaAtrasada(et({ status: 'pendente', dias_atraso: 0 })), false, 'vence hoje ainda não venceu');
  assert.equal(estaAtrasada(et({ status: 'pendente', dias_atraso: null })), false, 'sem prazo, sem atraso');
});

test('cumprimento de prazo só julga o que dá para julgar', () => {
  assert.equal(concluiuNoPrazo(et({ status: 'concluida', dias_atraso: 0 })), true);
  assert.equal(concluiuNoPrazo(et({ status: 'concluida', dias_atraso: -4 })), true);
  assert.equal(concluiuNoPrazo(et({ status: 'concluida', dias_atraso: 2 })), false);
  assert.equal(concluiuNoPrazo(et({ status: 'concluida', dias_atraso: null })), null, 'sem prazo cadastrado');
  assert.equal(concluiuNoPrazo(et({ status: 'pendente', dias_atraso: 5 })), null, 'ainda aberta');
  assert.equal(concluiuNoPrazo(et({ status: 'dispensada', dias_atraso: 5 })), null, 'não havia prazo a cumprir');
});

test('resumo conta etapas e processos', () => {
  const r = resumoIndicadores([
    et({ status: 'pendente', dias_atraso: 3 }),
    et({ status: 'em_andamento', dias_atraso: -1, responsavel_id: null }),
    et({ status: 'concluida', dias_atraso: 0 }),
    et({ status: 'concluida', dias_atraso: 5 }),
    et({ status: 'dispensada' }),
  ], [
    { status: 'em_andamento' }, { status: 'finalizado' }, { status: 'cancelado' },
  ]);

  assert.equal(r.etapas.total, 5);
  assert.equal(r.etapas.abertas, 2);
  assert.equal(r.etapas.concluidas, 2);
  assert.equal(r.etapas.dispensadas, 1);
  assert.equal(r.etapas.atrasadas, 1);
  assert.equal(r.etapas.semDono, 1);

  assert.equal(r.processos.total, 3);
  assert.equal(r.processos.emAndamento, 1);
  assert.equal(r.processos.finalizados, 1);
  assert.equal(r.processos.cancelados, 1);
});

// Uma mobilização pode travar em três passos e continua sendo UMA mobilização
// em apuros — o número que o gestor pergunta.
test('processos atrasados conta processos, não etapas', () => {
  const r = resumoIndicadores([
    et({ processo_id: 'p1', dias_atraso: 3 }),
    et({ processo_id: 'p1', dias_atraso: 8 }),
    et({ processo_id: 'p2', dias_atraso: 1 }),
  ], []);
  assert.equal(r.etapas.atrasadas, 3);
  assert.equal(r.processos.atrasados, 2);
});

test('percentual de cumprimento ignora o que não dá para medir', () => {
  const r = resumoIndicadores([
    et({ status: 'concluida', dias_atraso: 0 }),
    et({ status: 'concluida', dias_atraso: -2 }),
    et({ status: 'concluida', dias_atraso: 4 }),
    et({ status: 'concluida', dias_atraso: null }),
  ], []);
  assert.equal(r.prazo.medidas, 3);
  assert.equal(r.prazo.noPrazo, 2);
  assert.equal(r.prazo.fora, 1);
  assert.equal(r.prazo.semPrazo, 1, 'fica visível para a lacuna de configuração não sumir');
  assert.equal(r.prazo.pct, 67);
});

// Média de nada não é zero: zero significaria "nenhuma cumpriu".
test('sem nada medido, o percentual é null', () => {
  const r = resumoIndicadores([et({ status: 'pendente' })], []);
  assert.equal(r.prazo.pct, null);
  assert.equal(formatarPct(r.prazo.pct), '—');
  assert.equal(faixaPct(r.prazo.pct), 'vazio');
});

test('faixas de cor do percentual', () => {
  assert.equal(faixaPct(100), 'alta');
  assert.equal(faixaPct(90), 'alta');
  assert.equal(faixaPct(89), 'media');
  assert.equal(faixaPct(70), 'media');
  assert.equal(faixaPct(69), 'baixa');
  assert.equal(faixaPct(0), 'baixa');
});

// O achado que a planilha nunca deu.
test('gargalos rankeiam a etapa que mais trava', () => {
  const g = gargalosPorEtapa([
    { titulo: 'Aprovação do cliente final', status: 'concluida', dias_atraso: 20 },
    { titulo: 'Aprovação do cliente final', status: 'concluida', dias_atraso: 30 },
    { titulo: 'Aprovação do cliente final', status: 'pendente', dias_atraso: 12 },
    { titulo: 'Exames', status: 'concluida', dias_atraso: -1 },
  ]);
  assert.equal(g[0].nome, 'Aprovação do cliente final');
  assert.equal(g[0].total, 3);
  assert.equal(g[0].foraDoPrazo, 2);
  assert.equal(g[0].abertasAtrasadas, 1);
  assert.equal(g[0].atrasoMedio, 25, 'média só das concluídas');
  assert.equal(g[1].atrasoMedio, -1);
});

// Incluir as abertas na média a faria subir todo dia sozinha.
test('etapa sem conclusão não tem atraso médio', () => {
  const g = gargalosPorEtapa([{ titulo: 'Postagem', status: 'pendente', dias_atraso: 40 }]);
  assert.equal(g[0].atrasoMedio, null);
  assert.equal(g[0].abertasAtrasadas, 1);
});

test('agrupamentos vêm ordenados do maior para o menor', () => {
  const r = resumoIndicadores([
    et({ fluxoLabel: 'Mobilização de pessoas' }),
    et({ fluxoLabel: 'Mobilização de pessoas' }),
    et({ fluxoLabel: 'Mobilização da empresa' }),
  ], []);
  assert.deepEqual(r.abertasPorFluxo, [
    { nome: 'Mobilização de pessoas', total: 2 },
    { nome: 'Mobilização da empresa', total: 1 },
  ]);
});

test('sem responsável aparece nomeado no ranking de atraso', () => {
  const r = resumoIndicadores([et({ dias_atraso: 5, responsavel_id: null, responsavelNome: null })], []);
  assert.deepEqual(r.atrasadasPorResponsavel, [{ nome: 'Sem responsável', total: 1 }]);
});

test('lista vazia não quebra nada', () => {
  const r = resumoIndicadores([], []);
  assert.equal(r.etapas.total, 0);
  assert.equal(r.prazo.pct, null);
  assert.deepEqual(r.gargalos, []);
});

// ---------------------------------------------------------------------------
// Detalhe por trás dos cards clicáveis
// ---------------------------------------------------------------------------

test('etapas vencidas vêm da pior para a menos pior', () => {
  const r = etapasVencidas([
    et({ id: 'a', titulo: 'ASO', dias_atraso: 3 }),
    et({ id: 'b', titulo: 'Exames', dias_atraso: 12 }),
    et({ id: 'c', titulo: 'Dossiê', dias_atraso: -2 }),
    et({ id: 'd', titulo: 'Crachá', dias_atraso: 20, status: 'concluida' }),
  ]);
  assert.deepEqual(r.map((e) => e.titulo), ['Exames', 'ASO'],
    'só o que ainda está em jogo, e em ordem de atraso');
});

// O card conta PROCESSOS; listar etapas soltas faria o detalhe não bater com o
// número que a pessoa clicou.
test('processos travados agrupam as etapas do mesmo processo', () => {
  const etapas = [
    et({ id: '1', processo_id: 'p1', titulo: 'Exames', dias_atraso: 4 }),
    et({ id: '2', processo_id: 'p1', titulo: 'ASO', dias_atraso: 9 }),
    et({ id: '3', processo_id: 'p2', titulo: 'Dossiê', dias_atraso: 2 }),
    et({ id: '4', processo_id: 'p3', titulo: 'Crachá', dias_atraso: -5 }),
  ];
  const processos = [
    { id: 'p1', numero: 7, titulo: 'FULANO', fluxo: 'mobilizacao_pessoa' },
    { id: 'p2', numero: 8, titulo: 'BELTRANO', fluxo: 'mobilizacao_pessoa' },
  ];
  const r = processosTravados(etapas, processos);

  assert.equal(r.length, 2, 'p3 não tem etapa vencida');
  assert.equal(r[0].id, 'p1', 'o pior atraso vem primeiro');
  assert.equal(r[0].numero, 7);
  assert.equal(r[0].titulo, 'FULANO');
  assert.equal(r[0].etapas.length, 2);
  assert.equal(r[0].piorAtraso, 9);
  assert.equal(r[1].piorAtraso, 2);
});

// O detalhe tem de bater com o card, senão a pessoa clica em "3" e vê 5 linhas.
test('o detalhe bate com o número do card', () => {
  const etapas = [
    et({ id: '1', processo_id: 'p1', dias_atraso: 4 }),
    et({ id: '2', processo_id: 'p1', dias_atraso: 9 }),
    et({ id: '3', processo_id: 'p2', dias_atraso: 2 }),
  ];
  const r = resumoIndicadores(etapas, []);
  assert.equal(processosTravados(etapas, []).length, r.processos.atrasados);
  assert.equal(etapasVencidas(etapas).length, r.etapas.atrasadas);
});

test('processo sem cadastro na lista ainda aparece no detalhe', () => {
  const r = processosTravados([et({ processo_id: 'orfao', dias_atraso: 3 })], []);
  assert.equal(r.length, 1, 'melhor uma linha sem título do que sumir do detalhe');
  assert.equal(r[0].id, 'orfao');
});

test('sem etapa vencida, os dois detalhes são vazios', () => {
  assert.deepEqual(etapasVencidas([]), []);
  assert.deepEqual(processosTravados([], []), []);
});

// ---- processo fora de jogo não gera trabalho aberto nem atraso ----

const etapaDe = (statusProcesso, extra = {}) => ({
  id: `e-${Math.random()}`, processo_id: `p-${statusProcesso}`, titulo: 'Exames',
  status: 'pendente', dias_atraso: 200, responsavel_id: null,
  processoStatus: statusProcesso, ...extra,
});

// O caso real: em 09/09/2026 os cinco processos mais "travados" do indicador
// eram todos CANCELADOS — um deles com 222 dias. O relógio deles continuou
// correndo depois que alguém desistiu.
test('etapa pendente de processo cancelado não conta como travada', () => {
  assert.equal(etapaTravada(etapaDe('em_andamento')), true);
  assert.equal(etapaTravada(etapaDe('cancelado')), false);
  assert.equal(etapaTravada(etapaDe('finalizado')), false);
});

test('a mesma regra vale para "trabalho aberto"', () => {
  assert.equal(etapaAberta(etapaDe('em_andamento')), true);
  assert.equal(etapaAberta(etapaDe('cancelado')), false);
});

// Sem o status junto, nada muda — quem chama sem essa informação continua
// vendo o que via, e esconder por falta de dado seria pior que mostrar a mais.
test('sem o status do processo, assume que está em jogo', () => {
  assert.equal(etapaTravada({ status: 'pendente', dias_atraso: 5 }), true);
  assert.equal(etapaAberta({ status: 'pendente', dias_atraso: 5 }), true);
});

// O que NÃO pode mudar: o histórico. A etapa concluída aconteceu de verdade,
// mesmo que o processo tenha sido cancelado depois.
test('etapa concluída de processo cancelado continua contando no histórico', () => {
  const feita = etapaDe('cancelado', { status: 'concluida', dias_atraso: -2 });
  const r = resumoIndicadores([feita], [{ id: 'p-cancelado', status: 'cancelado' }]);
  assert.equal(r.etapas.concluidas, 1);
  assert.equal(r.prazo.medidas, 1, 'entra na conta do % no prazo');
  assert.equal(r.etapas.atrasadas, 0);
});

test('processosTravados ignora o que foi cancelado', () => {
  const etapas = [etapaDe('em_andamento'), etapaDe('cancelado')];
  const processos = [
    { id: 'p-em_andamento', numero: 1, titulo: 'Vivo', status: 'em_andamento' },
    { id: 'p-cancelado', numero: 2, titulo: 'Morto', status: 'cancelado' },
  ];
  const travados = processosTravados(etapas, processos);
  assert.equal(travados.length, 1);
  assert.equal(travados[0].titulo, 'Vivo');
});
