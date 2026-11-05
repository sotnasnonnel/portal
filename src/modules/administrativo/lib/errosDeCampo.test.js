import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ariaDoErro, coletarErros, errosDoEsquema, errosDoServico } from './errosDeCampo.js';
import {
  DESMOBILIZACAO, INCLUSAO_TREINAMENTO, MOVIMENTACAO, inicialMobilizacao, validarMobilizacao,
} from '../app/novo/formularios/mobilizacao.js';
import { inicialSaudeSeguranca, validarSaudeSeguranca } from '../app/novo/formularios/saudeSeguranca.js';

const mobilizacao = (extra = {}) => errosDoServico({
  classe: 'mobilizacao',
  servico: 'mobilizacao',
  validar: validarMobilizacao,
  valores: { ...inicialMobilizacao(), ...extra },
});

test('esquema: aponta todos os campos que faltam, não só o primeiro', () => {
  const erros = errosDoEsquema([
    { chave: 'a', rotulo: 'A', tipo: 'texto', obrigatorio: true },
    { chave: 'b', rotulo: 'B', tipo: 'texto' },
    { chave: 'c', rotulo: 'C', tipo: 'cep', obrigatorio: false },
    { chave: 'd', rotulo: 'D', tipo: 'texto', obrigatorio: true },
  ], { c: '123' });
  assert.deepEqual(Object.keys(erros).sort(), ['a', 'c', 'd']);
  assert.equal(erros.a, 'Preencha este campo.');
  assert.match(erros.c, /oito dígitos/);
});

test('esquema: campo que não se aplica não acusa erro', () => {
  const erros = errosDoEsquema(
    [{ chave: 'km', rotulo: 'KM', tipo: 'selecao', obrigatorio: true, aplica: () => false }],
    {},
  );
  assert.deepEqual(erros, {});
});

test('mobilização nova: todos os obrigatórios aparecem de uma vez', () => {
  const { erros, semCampo } = mobilizacao();
  assert.equal(semCampo, '');
  assert.deepEqual(Object.keys(erros).sort(), [
    'cc', 'cliente', 'contato_email', 'contato_nome', 'contato_telefone',
    'data_inicio_cliente', 'local_obra', 'profissional_id', 'projeto',
  ]);
});

test('mobilização: a primeira mensagem é a mesma que o validador devolve', () => {
  const { erros } = mobilizacao();
  assert.equal(erros.profissional_id, validarMobilizacao(inicialMobilizacao()));
});

test('movimentação: pergunta o crachá, mas não o "entregue" antes do "possui"', () => {
  const { erros } = mobilizacao({ movimento: MOVIMENTACAO });
  assert.ok(erros.data_desmob);
  assert.ok(erros.desmob_possui_cracha);
  assert.equal(erros.desmob_cracha_entregue, undefined);

  const comCracha = mobilizacao({ movimento: MOVIMENTACAO, desmob_possui_cracha: 'sim' });
  assert.ok(comCracha.erros.desmob_cracha_entregue);
});

test('desmobilização e inclusão de treinamento: só o que aquele movimento pede', () => {
  assert.deepEqual(
    Object.keys(mobilizacao({ movimento: DESMOBILIZACAO, devolucao: true }).erros).sort(),
    ['data_desmob', 'devolucao_descricao', 'profissional_id'],
  );
  assert.ok(mobilizacao({ movimento: INCLUSAO_TREINAMENTO }).erros.treinamentos);
  assert.equal(mobilizacao({ movimento: INCLUSAO_TREINAMENTO }).erros.projeto, undefined);
});

test('mobilização preenchida: sem erro nenhum', () => {
  const { erros, semCampo } = mobilizacao({
    profissional_id: 'p', projeto: 'X', cliente: 'c', cc: 'cc', local_obra: 'l',
    data_inicio_cliente: '2026-01-01', contato_nome: 'n', contato_telefone: '31999999999',
    contato_email: 'a@b.com',
  });
  assert.deepEqual(erros, {});
  assert.equal(semCampo, '');
});

test('saúde e segurança: EPI aponta catálogo, motivo e CC', () => {
  const { erros, semCampo } = errosDoServico({
    classe: 'saude-seguranca',
    servico: 'epi',
    validar: (v) => validarSaudeSeguranca(v, 'epi'),
    valores: inicialSaudeSeguranca(),
  });
  assert.equal(semCampo, '');
  assert.deepEqual(Object.keys(erros).sort(), ['cc', 'itens', 'motivo']);
});

test('saúde e segurança: quantidade inválida fica no campo do catálogo', () => {
  const { erros } = errosDoServico({
    classe: 'saude-seguranca',
    servico: 'epi',
    validar: (v) => validarSaudeSeguranca(v, 'epi'),
    valores: { ...inicialSaudeSeguranca(), cc: 'x', motivo: 'y', itens: [{ variante_id: 'v', quantidade: 0 }] },
  });
  assert.match(erros.itens, /quantidade/);
});

test('mensagem sem campo conhecido vai para o aviso geral, em vez de sumir', () => {
  const { erros, semCampo } = coletarErros(() => 'Regra nova.', {}, [[/outra/, 'x', {}]]);
  assert.deepEqual(erros, {});
  assert.equal(semCampo, 'Regra nova.');
});

test('correção que não resolve não prende o laço', () => {
  const { erros } = coletarErros(() => 'Sempre.', {}, [[/Sempre/, 'x', {}]]);
  assert.deepEqual(erros, { x: 'Sempre.' });
});

test('aria: só marca o controle que tem erro', () => {
  assert.deepEqual(ariaDoErro('a', ''), {});
  assert.deepEqual(ariaDoErro('a', 'msg'), { 'aria-invalid': true, 'aria-describedby': 'adm-erro-a' });
});
