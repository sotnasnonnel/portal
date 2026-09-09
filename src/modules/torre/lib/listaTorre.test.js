import test from 'node:test';
import assert from 'node:assert/strict';
import {
  atrasoDoChamado, montarLista, estaAtrasada, filtrarLista, opcoesDaLista, resumoDaLista,
} from './listaTorre.js';

const HOJE = '2026-09-09';

const etapa = (extra = {}) => ({
  id: 'e1', numero: 7, titulo: 'Exames', processoTitulo: 'FULANO DE TAL',
  processo_id: 'p1', fluxo: 'mobilizacao_pessoa', status: 'pendente',
  data_prevista: '2026-09-01', data_real: null, dias_atraso: 8,
  responsavel_id: 'r1', responsavelNome: 'Edijane', ...extra,
});

const chamado = (extra = {}) => ({
  id: 'c1', numero: 42, classe: 'saude-seguranca', servico: 'uniforme',
  assunto: 'Solicitação de uniforme', status: 'em_atendimento',
  sla_vence_em: '2026-09-05T18:00:00Z', fechado_em: null,
  atendente_id: 'a1', atendenteNome: 'Ivone', ...extra,
});

// ---- atraso do chamado ----

test('atraso do chamado conta em dias inteiros, não em milissegundos', () => {
  // Vence hoje às 18h: de manhã NÃO está atrasado. Comparar o instante daria 1.
  assert.equal(atrasoDoChamado({ sla_vence_em: '2026-09-09T18:00:00Z' }, HOJE), 0);
  assert.equal(atrasoDoChamado({ sla_vence_em: '2026-09-05T18:00:00Z' }, HOJE), 4);
  assert.equal(atrasoDoChamado({ sla_vence_em: '2026-09-20T09:00:00Z' }, HOJE), -11);
});

test('chamado sem prazo não tem atraso, e chamado fechado congela no dia que fechou', () => {
  assert.equal(atrasoDoChamado({ sla_vence_em: null }, HOJE), null);
  const fechado = { sla_vence_em: '2026-09-01T12:00:00Z', fechado_em: '2026-09-03T08:00:00Z' };
  assert.equal(atrasoDoChamado(fechado, HOJE), 2, 'não continua contando depois de fechado');
});

// ---- montagem ----

test('as duas origens entram na mesma lista, cada uma dizendo de onde veio', () => {
  const linhas = montarLista({ etapas: [etapa()], chamados: [chamado()], hoje: HOJE });
  assert.equal(linhas.length, 2);
  assert.deepEqual(linhas.map((l) => l.origem).sort(), ['adm', 'mobilizacao']);
});

test('a linha do chamado usa o rótulo do serviço, não o slug', () => {
  const [linha] = montarLista({ chamados: [chamado()], hoje: HOJE });
  assert.equal(linha.titulo, 'Solicitação de uniforme');
  assert.equal(linha.grupo, 'Chamado do Adm');
  assert.equal(linha.link, '/administrativo/chamado/c1');
});

test('a linha da etapa aponta para o processo, não para a etapa', () => {
  const [linha] = montarLista({ etapas: [etapa()], hoje: HOJE });
  assert.equal(linha.link, '/mobilizacao/processo/p1');
  assert.equal(linha.contexto, 'FULANO DE TAL');
});

// A ordem é o que faz a tela útil na reunião.
test('o mais atrasado vem primeiro, e o sem prazo vai para o fim', () => {
  const linhas = montarLista({
    etapas: [
      etapa({ id: 'e-sem', titulo: 'Sem prazo', dias_atraso: null }),
      etapa({ id: 'e-pouco', titulo: 'Pouco atraso', dias_atraso: 2 }),
    ],
    chamados: [chamado({ id: 'c-muito', sla_vence_em: '2026-08-01T12:00:00Z' })],
    hoje: HOJE,
  });
  assert.equal(linhas[0].origem, 'adm', 'o chamado com 39 dias lidera');
  assert.equal(linhas[1].titulo, 'Pouco atraso');
  assert.equal(linhas[2].titulo, 'Sem prazo');
});

test('atrasada exige prazo vencido E não terminado', () => {
  const [aberta] = montarLista({ etapas: [etapa({ dias_atraso: 5 })], hoje: HOJE });
  assert.equal(estaAtrasada(aberta), true);

  const [feita] = montarLista({
    etapas: [etapa({ dias_atraso: 5, data_real: '2026-09-06', status: 'concluida' })], hoje: HOJE,
  });
  assert.equal(estaAtrasada(feita), false, 'concluída com atraso já não está travada');
});

// ---- filtros ----

test('o filtro de origem separa os dois mundos', () => {
  const linhas = montarLista({ etapas: [etapa()], chamados: [chamado()], hoje: HOJE });
  assert.equal(filtrarLista(linhas, { origem: 'adm' }).length, 1);
  assert.equal(filtrarLista(linhas, { origem: 'mobilizacao' }).length, 1);
  assert.equal(filtrarLista(linhas, {}).length, 2, 'vazio é "todos"');
});

// O bug que a chave composta evita: 'concluida' e 'fechado' são estados de
// coisas diferentes, e o seletor de um não pode filtrar o outro junto.
test('o filtro de situação é por origem:status, não só pelo status', () => {
  const linhas = montarLista({
    etapas: [etapa({ status: 'pendente' })],
    chamados: [chamado({ status: 'pendente' })],
    hoje: HOJE,
  });
  const so = filtrarLista(linhas, { status: 'adm:pendente' });
  assert.equal(so.length, 1);
  assert.equal(so[0].origem, 'adm');
});

test('busca acha por título, contexto e número, sem acento', () => {
  const linhas = montarLista({ etapas: [etapa()], chamados: [chamado()], hoje: HOJE });
  assert.equal(filtrarLista(linhas, { busca: 'fulano' }).length, 1);
  assert.equal(filtrarLista(linhas, { busca: 'SOLICITACAO' }).length, 1, 'sem acento e sem caixa');
  assert.equal(filtrarLista(linhas, { busca: '42' }).length, 1, 'pelo número do chamado');
});

test('filtro por responsável cobre os dois lados e o "sem dono"', () => {
  const linhas = montarLista({
    etapas: [etapa()],
    chamados: [chamado(), chamado({ id: 'c2', atendente_id: null, atendenteNome: '' })],
    hoje: HOJE,
  });
  assert.equal(filtrarLista(linhas, { responsavelId: 'a1' }).length, 1);
  assert.equal(filtrarLista(linhas, { responsavelId: 'sem' }).length, 1);
});

// ---- opções e resumo ----

test('as opções saem do que está na tela, com a situação rotulada por origem', () => {
  const linhas = montarLista({ etapas: [etapa()], chamados: [chamado()], hoje: HOJE });
  const o = opcoesDaLista(linhas);

  assert.deepEqual(o.responsaveis.map((r) => r.label), ['Edijane', 'Ivone']);
  assert.deepEqual(o.grupos.map((g) => g.value).sort(), ['adm', 'mobilizacao_pessoa']);
  assert.ok(o.situacoes.some((s) => s.value === 'adm:em_atendimento' && /chamado/.test(s.label)));
  assert.ok(o.situacoes.some((s) => s.value === 'mobilizacao:pendente' && /etapa/.test(s.label)));
  assert.equal(o.temSemResponsavel, false);
});

test('o resumo conta por origem e o que está travado', () => {
  const linhas = montarLista({
    etapas: [etapa(), etapa({ id: 'e2', dias_atraso: -3 })],
    chamados: [chamado()],
    hoje: HOJE,
  });
  assert.deepEqual(resumoDaLista(linhas), {
    total: 3, mobilizacao: 2, chamados: 1, atrasadas: 2,
  });
});

// ---- o que já acabou ----

// A lista é "o que falta". Sem isto ela abria com ~1300 linhas de histórico na
// frente das ~50 que a reunião precisa discutir.
test('encerrado fica fora por padrão, dos dois lados', () => {
  const linhas = montarLista({
    etapas: [
      etapa({ id: 'e-ok', status: 'pendente' }),
      etapa({ id: 'e-fim', status: 'concluida', data_real: '2026-09-01' }),
      etapa({ id: 'e-disp', status: 'dispensada' }),
    ],
    chamados: [
      chamado({ id: 'c-ok', status: 'aberto' }),
      chamado({ id: 'c-fim', status: 'fechado', fechado_em: '2026-09-02T10:00:00Z' }),
      chamado({ id: 'c-rep', status: 'reprovado' }),
    ],
    hoje: HOJE,
  });

  assert.equal(filtrarLista(linhas, {}).length, 2, 'só o que ainda está em jogo');
  assert.equal(filtrarLista(linhas, { incluirEncerradas: true }).length, 6);
});

// Pedir a situação é pedir explicitamente por ela — inclusive uma encerrada.
test('escolher uma situação encerrada mostra o que ela pede', () => {
  const linhas = montarLista({
    etapas: [etapa({ id: 'e-fim', status: 'concluida', data_real: '2026-09-01' })],
    hoje: HOJE,
  });
  assert.equal(filtrarLista(linhas, { status: 'mobilizacao:concluida' }).length, 1);
});
