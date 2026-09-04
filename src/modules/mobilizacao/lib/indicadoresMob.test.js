import test from 'node:test';
import assert from 'node:assert/strict';
import {
  estaAtrasada, concluiuNoPrazo, resumoIndicadores, gargalosPorEtapa,
  faixaPct, formatarPct,
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
