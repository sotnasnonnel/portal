import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COLUNAS_KANBAN, agruparEmColunas, semaforoPrazo, contarNaoLidas, iniciais,
  filtrarQuadro, opcoesDoQuadro,
  filtrarFila, opcoesDaFila,
} from './painel.js';

const HORA = 3600 * 1000;
const AGORA = new Date('2026-08-10T12:00:00Z').getTime();
const daqui = (h) => new Date(AGORA + h * HORA).toISOString();

test('as cinco colunas cobrem todos os status, sem sobreposição', () => {
  const todos = COLUNAS_KANBAN.flatMap((c) => c.status);
  assert.equal(new Set(todos).size, todos.length, 'status repetido em duas colunas');
  assert.deepEqual(todos.sort(), [
    'aberto', 'aguardando_aprovacao', 'aguardando_solicitante',
    'cancelado', 'em_atendimento', 'fechado', 'reprovado',
  ]);
});

test('encerrados caem todos na mesma coluna', () => {
  const cols = agruparEmColunas([
    { id: 1, status: 'fechado' }, { id: 2, status: 'reprovado' },
    { id: 3, status: 'cancelado' }, { id: 4, status: 'aberto' },
  ]);
  const concluido = cols.find((c) => c.chave === 'concluido');
  assert.deepEqual(concluido.itens.map((i) => i.id), [1, 2, 3]);
  assert.equal(cols.find((c) => c.chave === 'aberto').itens.length, 1);
});

test('nenhum chamado se perde no agrupamento', () => {
  const chamados = ['aguardando_aprovacao', 'aberto', 'em_atendimento', 'aguardando_solicitante', 'fechado']
    .map((status, id) => ({ id, status }));
  const total = agruparEmColunas(chamados).reduce((s, c) => s + c.itens.length, 0);
  assert.equal(total, chamados.length);
});

// Sem vencimento não há o que semaforizar: verde sugeriria folga inexistente.
test('semáforo distingue sem prazo, folga, aperto e atraso', () => {
  assert.equal(semaforoPrazo(null, AGORA), 'sem-prazo');
  assert.equal(semaforoPrazo(daqui(48), AGORA), 'ok');
  assert.equal(semaforoPrazo(daqui(5), AGORA), 'perto');
  assert.equal(semaforoPrazo(daqui(24), AGORA), 'perto', 'exatamente 24h ainda é aperto');
  assert.equal(semaforoPrazo(daqui(-1), AGORA), 'vencido');
});

// Sem este filtro, responder deixaria o próprio chamado marcado como pendente.
test('minha própria mensagem nunca conta como não lida', () => {
  const msgs = [
    { autor_id: 'eu', lida_atendente_em: null },
    { autor_id: 'outro', lida_atendente_em: null },
  ];
  assert.equal(contarNaoLidas(msgs, { meuId: 'eu', souSolicitante: false }), 1);
});

test('cada lado olha a própria coluna de leitura', () => {
  const msgs = [{ autor_id: 'outro', lida_solicitante_em: '2026-08-10', lida_atendente_em: null }];
  assert.equal(contarNaoLidas(msgs, { meuId: 'eu', souSolicitante: true }), 0);
  assert.equal(contarNaoLidas(msgs, { meuId: 'eu', souSolicitante: false }), 1);
});

test('iniciais lidam com nome simples, composto e vazio', () => {
  assert.equal(iniciais('Paulo Ricardo dos Santos'), 'PS');
  assert.equal(iniciais('Alessandra'), 'AL');
  assert.equal(iniciais(''), '?');
  assert.equal(iniciais(null), '?');
});

// ---- filtros do quadro (visão do Adm sobre um projeto) ----
const board = [
  { id: 1, solicitante_id: 'p1', solicitanteNome: 'Ana', cc: 'CC-100' },
  { id: 2, solicitante_id: 'p2', solicitanteNome: 'Bruno', cc: 'CC-100' },
  { id: 3, solicitante_id: 'p1', solicitanteNome: 'Ana', cc: 'CC-200' },
  { id: 4, solicitante_id: 'p3', solicitanteNome: 'Carla', cc: '' },
];

test('filtro vazio significa todos, nunca nenhum', () => {
  assert.equal(filtrarQuadro(board, {}).length, 4);
  assert.equal(filtrarQuadro(board, { solicitanteId: '', cc: '' }).length, 4);
});

test('filtra por solicitante e por CC, e os dois juntos', () => {
  assert.deepEqual(filtrarQuadro(board, { solicitanteId: 'p1' }).map((c) => c.id), [1, 3]);
  assert.deepEqual(filtrarQuadro(board, { cc: 'CC-100' }).map((c) => c.id), [1, 2]);
  assert.deepEqual(filtrarQuadro(board, { solicitanteId: 'p1', cc: 'CC-100' }).map((c) => c.id), [1]);
});

// Serviço sem CC (manutenção Sede, impressoras) não pode entrar num filtro de CC.
test('chamado sem CC fica de fora ao filtrar por CC', () => {
  assert.deepEqual(filtrarQuadro(board, { cc: 'CC-100' }).map((c) => c.id), [1, 2]);
  assert.equal(filtrarQuadro(board, { cc: 'CC-999' }).length, 0);
});

test('opções vêm do que está no quadro, sem repetir e em ordem', () => {
  const { solicitantes, ccs } = opcoesDoQuadro(board);
  assert.deepEqual(solicitantes.map((s) => s.label), ['Ana', 'Bruno', 'Carla']);
  assert.deepEqual(ccs, ['CC-100', 'CC-200']);
});

test('quadro vazio não quebra os filtros', () => {
  assert.deepEqual(filtrarQuadro([], { cc: 'CC-1' }), []);
  assert.deepEqual(opcoesDoQuadro([]), { solicitantes: [], ccs: [] });
});

// ---- filtros da fila de atendimento ----

const naFila = (extra = {}) => ({
  assunto: 'Solicitação de viagem Uber', status: 'aberto',
  solicitante_id: 's1', solicitanteNome: 'ANA',
  atendente_id: 'a1', atendenteNome: 'EDIJANE',
  criado_em: '2026-08-21T14:00:00Z',
  ...extra,
});

test('sem filtro, a fila passa inteira', () => {
  const fila = [naFila(), naFila({ assunto: 'Solicitação de EPI' })];
  assert.equal(filtrarFila(fila, {}).length, 2);
  assert.equal(filtrarFila(fila).length, 2);
});

// Quem digita "uber" não digita o acento nem a frase inteira.
test('assunto busca por pedaço, sem acento e sem caixa', () => {
  const fila = [naFila(), naFila({ assunto: 'Solicitação de EPI' })];
  assert.equal(filtrarFila(fila, { assunto: 'uber' }).length, 1);
  assert.equal(filtrarFila(fila, { assunto: 'SOLICITACAO' }).length, 2);
  assert.equal(filtrarFila(fila, { assunto: 'nada disso' }).length, 0);
});

test('status, solicitante e responsável filtram por igualdade', () => {
  const fila = [naFila(), naFila({ status: 'em_atendimento', solicitante_id: 's2', atendente_id: 'a2' })];
  assert.equal(filtrarFila(fila, { status: 'aberto' }).length, 1);
  assert.equal(filtrarFila(fila, { solicitanteId: 's2' }).length, 1);
  assert.equal(filtrarFila(fila, { atendenteId: 'a1' }).length, 1);
});

// "Sem responsável" é o filtro que interessa ao time: é a fila que ninguém pegou.
test('filtro "sem" acha só os que ninguém assumiu', () => {
  const fila = [naFila(), naFila({ atendente_id: null, atendenteNome: '' })];
  assert.equal(filtrarFila(fila, { atendenteId: 'sem' }).length, 1);
});

// Comparar por texto e não por Date: new Date('2026-08-21') é UTC e jogaria o
// chamado da manhã para o dia anterior no nosso fuso.
test('período usa o dia do ISO, sem escorregar de fuso', () => {
  const fila = [
    naFila({ criado_em: '2026-08-20T23:00:00Z' }),
    naFila({ criado_em: '2026-08-21T02:00:00Z' }),
    naFila({ criado_em: '2026-08-22T10:00:00Z' }),
  ];
  assert.equal(filtrarFila(fila, { criadoDe: '2026-08-21' }).length, 2);
  assert.equal(filtrarFila(fila, { criadoAte: '2026-08-21' }).length, 2);
  assert.equal(filtrarFila(fila, { criadoDe: '2026-08-21', criadoAte: '2026-08-21' }).length, 1);
});

test('filtros se somam', () => {
  const fila = [naFila(), naFila({ assunto: 'Solicitação de EPI', atendente_id: 'a2' })];
  assert.equal(filtrarFila(fila, { assunto: 'EPI', atendenteId: 'a1' }).length, 0);
});

test('opções saem do que está na fila, ordenadas por nome', () => {
  const o = opcoesDaFila([
    naFila({ solicitanteNome: 'ZORA', solicitante_id: 's9' }),
    naFila({ status: 'em_atendimento' }),
  ]);
  assert.deepEqual(o.solicitantes.map((x) => x.label), ['ANA', 'ZORA']);
  assert.deepEqual(o.responsaveis.map((x) => x.label), ['EDIJANE']);
  assert.deepEqual(o.status, ['aberto', 'em_atendimento']);
  assert.equal(o.temSemResponsavel, false);
});

test('"sem responsável" só é oferecido quando existe algum', () => {
  assert.equal(opcoesDaFila([naFila({ atendente_id: null })]).temSemResponsavel, true);
});
