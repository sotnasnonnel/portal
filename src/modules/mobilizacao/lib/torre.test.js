import test from 'node:test';
import assert from 'node:assert/strict';
import { STATUS_LABEL as STATUS_ADM } from '../../administrativo/lib/statusChamado.js';
import { STATUS_LABEL as STATUS_MOB } from './statusEtapa.js';
import {
  COLUNAS_TORRE, statusUnificado, agruparTorre, linkDoItem,
  estaVencido, filtrarTorre, opcoesDaTorre, SEM_RESPONSAVEL, responsavelDoItem,
} from './torre.js';

/**
 * O teste que sustenta a torre: um status novo em qualquer um dos dois módulos
 * quebra aqui, e não em silêncio na tela. Sem ele, um chamado com status
 * desconhecido simplesmente sumiria do quadro.
 */
test('todo status do Administrativo tem tradução', () => {
  const orfaos = Object.keys(STATUS_ADM).filter((s) => !statusUnificado('adm', s));
  assert.deepEqual(orfaos, []);
});

test('todo status da Mobilização tem tradução', () => {
  const orfaos = Object.keys(STATUS_MOB).filter((s) => !statusUnificado('mobilizacao', s));
  assert.deepEqual(orfaos, []);
});

test('origem desconhecida não vira coluna', () => {
  assert.equal(statusUnificado('financeiro', 'aberto'), null);
  assert.equal(statusUnificado('adm', 'status_que_nao_existe'), null);
});

// Dos dois lados a bola está com outra pessoa — é isso que a torre precisa dizer.
test('os dois "aguardando" do Adm caem na mesma coluna', () => {
  assert.equal(statusUnificado('adm', 'aguardando_aprovacao'), 'aguardando');
  assert.equal(statusUnificado('adm', 'aguardando_solicitante'), 'aguardando');
});

test('reprovado e cancelado contam como concluídos', () => {
  assert.equal(statusUnificado('adm', 'reprovado'), 'concluido');
  assert.equal(statusUnificado('adm', 'cancelado'), 'concluido');
  assert.equal(statusUnificado('mobilizacao', 'dispensada'), 'concluido');
});

test('agrupa os dois mundos nas mesmas colunas', () => {
  const cols = agruparTorre([
    { id: 'c1', origem: 'adm', status: 'aberto' },
    { id: 'e1', origem: 'mobilizacao', status: 'pendente' },
    { id: 'c2', origem: 'adm', status: 'em_atendimento' },
    { id: 'e2', origem: 'mobilizacao', status: 'em_andamento' },
    { id: 'c3', origem: 'adm', status: 'aguardando_aprovacao' },
  ]);
  assert.deepEqual(cols.map((c) => c.chave), COLUNAS_TORRE.map((c) => c.chave));
  assert.deepEqual(cols.map((c) => c.itens.length), [2, 2, 1, 0]);
});

test('o cartão leva para o módulo de origem', () => {
  assert.equal(linkDoItem({ origem: 'adm', id: 'abc' }), '/administrativo/chamado/abc');
  assert.equal(linkDoItem({ origem: 'mobilizacao', id: 'e1', processo_id: 'p1' }),
    '/mobilizacao/processo/p1', 'a etapa leva ao PROCESSO, que é onde se age');
  assert.equal(linkDoItem({ origem: 'outro' }), null);
});

// Comparação como texto, e não como Date: 'AAAA-MM-DD' virado em Date é UTC, e
// um prazo que vence hoje apareceria vencido desde as 21h de ontem.
test('vencido compara datas sem passar por Date', () => {
  const item = { origem: 'adm', status: 'aberto', prazo: '2026-08-14' };
  assert.equal(estaVencido(item, '2026-08-15'), true);
  assert.equal(estaVencido(item, '2026-08-14'), false, 'vence hoje ainda não venceu');
  assert.equal(estaVencido(item, '2026-08-13'), false);
});

test('prazo com hora ainda funciona', () => {
  const item = { origem: 'adm', status: 'aberto', prazo: '2026-08-14T18:00:00Z' };
  assert.equal(estaVencido(item, '2026-08-15'), true);
});

test('concluído nunca está vencido', () => {
  assert.equal(estaVencido({ origem: 'adm', status: 'fechado', prazo: '2020-01-01' }, '2026-08-15'), false);
  assert.equal(estaVencido({ origem: 'mobilizacao', status: 'concluida', prazo: '2020-01-01' }, '2026-08-15'), false);
  assert.equal(estaVencido({ origem: 'adm', status: 'aberto', prazo: null }, '2026-08-15'), false);
});

test('filtros da torre: vazio é todos', () => {
  const itens = [
    { id: 'a', origem: 'adm', status: 'aberto', responsavel_id: 'x', responsavel_contrato: 'ANA', prazo: '2020-01-01' },
    { id: 'b', origem: 'mobilizacao', status: 'pendente', responsavel_id: null, responsavel_contrato: 'ZILDA', prazo: '2099-01-01' },
  ];
  assert.equal(filtrarTorre(itens, {}).length, 2);
  assert.deepEqual(filtrarTorre(itens, { origem: 'adm' }).map((i) => i.id), ['a']);
  assert.deepEqual(filtrarTorre(itens, { responsavelId: 'sem' }).map((i) => i.id), ['b']);
  assert.deepEqual(filtrarTorre(itens, { responsavel: 'ZILDA' }).map((i) => i.id), ['b']);
  assert.deepEqual(filtrarTorre(itens, { atrasados: true }).map((i) => i.id), ['a']);
});

test('opções saem do que está na torre', () => {
  const o = opcoesDaTorre([
    { responsavel_id: 'i1', responsavelNome: 'Ivone', responsavel_contrato: 'ZILDA' },
    { responsavel_id: 'e1', responsavelNome: 'Edijane', responsavel_contrato: 'ANA' },
    { responsavel_id: null, responsavel_contrato: null },
  ]);
  assert.deepEqual(o.responsaveis.map((r) => r.label), ['Edijane', 'Ivone']);
  assert.deepEqual(o.responsaveisContrato, ['ANA', 'ZILDA', '(nao identificado)']);
});

// ---- responsável pelo contrato ----

const item = (extra = {}) => ({
  origem: 'adm', id: 'x', status: 'aberto', responsavel_id: null,
  responsavel_contrato: 'PAULO CEZAR DE PAIVA NETO', ...extra,
});

// O motivo de o filtro existir: antes o Adm guardava "Equipe FULANO" e a
// Mobilização "ATNI-CT01", então escolher uma pessoa trazia metade do trabalho
// dela. O de-para resolve os dois para o mesmo nome, e o filtro passa a somar.
test('o filtro por responsável junta os dois mundos no mesmo nome', () => {
  const itens = [
    item({ origem: 'adm', id: 'c1' }),
    item({ origem: 'mobilizacao', id: 'e1' }),
    item({ origem: 'mobilizacao', id: 'e2', responsavel_contrato: 'OUTRA PESSOA' }),
  ];
  const so = filtrarTorre(itens, { responsavel: 'PAULO CEZAR DE PAIVA NETO' });
  assert.equal(so.length, 2);
  assert.deepEqual(so.map((i) => i.origem), ['adm', 'mobilizacao']);
});

test('sem de-para o item vira "(nao identificado)", e não some', () => {
  assert.equal(responsavelDoItem({ responsavel_contrato: null }), SEM_RESPONSAVEL);
  assert.equal(responsavelDoItem({ responsavel_contrato: '' }), SEM_RESPONSAVEL);

  const itens = [item(), item({ id: 'y', responsavel_contrato: null })];
  assert.equal(filtrarTorre(itens, { responsavel: SEM_RESPONSAVEL }).length, 1);
  assert.equal(filtrarTorre(itens, {}).length, 2, 'sem filtro, ninguém é escondido');
});

test('as opções são só nomes, e o "(nao identificado)" fica por último', () => {
  const itens = [
    item({ responsavel_contrato: 'ZILDA' }),
    item({ responsavel_contrato: null }),
    item({ responsavel_contrato: 'ANA' }),
    item({ responsavel_contrato: 'ANA' }),
  ];
  assert.deepEqual(opcoesDaTorre(itens).responsaveisContrato, ['ANA', 'ZILDA', SEM_RESPONSAVEL]);
});
