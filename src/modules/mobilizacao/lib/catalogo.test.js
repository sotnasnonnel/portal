import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ordenarEtapas, condicaoAtendida, etapasPrevistas,
  validarCatalogo, temErro, codigoDoTitulo,
} from './catalogo.js';

const et = (codigo, ordem, over = {}) => ({
  fluxo: 'mobilizacao_pessoa', codigo, ordem, titulo: codigo, ativo: true,
  depende_de: null, sla_dias_uteis: 1, condicao: {}, ...over,
});

test('ordena por ordem', () => {
  const r = ordenarEtapas([et('c', 2), et('a', 0), et('b', 1)]);
  assert.deepEqual(r.map((e) => e.codigo), ['a', 'b', 'c']);
});

test('condição vazia sempre atende', () => {
  assert.equal(condicaoAtendida({}, {}), true);
  assert.equal(condicaoAtendida(null, { movimento: 'X' }), true);
});

// É o que permite um fluxo só atender "Nova mobilização" e "Movimentação".
test('condição por movimento filtra a etapa', () => {
  const cond = { movimento: ['Nova mobilização'] };
  assert.equal(condicaoAtendida(cond, { movimento: 'Nova mobilização' }), true);
  assert.equal(condicaoAtendida(cond, { movimento: 'Movimentação de profissional' }), false);
});

// O silêncio pende para NÃO criar: criar uma etapa condicional sem saber a
// condição dá trabalho a alguém à toa.
test('campo ausente não atende a condição', () => {
  assert.equal(condicaoAtendida({ movimento: ['Nova mobilização'] }, {}), false);
});

test('etapasPrevistas respeita fluxo, ativo e condição', () => {
  const catalogo = [
    et('a', 0),
    et('b', 1, { condicao: { movimento: ['Nova mobilização'] } }),
    et('c', 2, { ativo: false }),
    et('d', 3, { fluxo: 'mobilizacao_empresa' }),
  ];
  const nova = etapasPrevistas(catalogo, 'mobilizacao_pessoa', { movimento: 'Nova mobilização' });
  assert.deepEqual(nova.map((e) => e.codigo), ['a', 'b']);

  const movimentacao = etapasPrevistas(catalogo, 'mobilizacao_pessoa', { movimento: 'Movimentação de profissional' });
  assert.deepEqual(movimentacao.map((e) => e.codigo), ['a']);
});

test('catálogo bem formado não tem problema nenhum', () => {
  const problemas = validarCatalogo([
    et('abertura', 0),
    et('exames', 1, { depende_de: 'abertura', sla_dias_uteis: 7 }),
    et('aso', 2, { depende_de: 'exames', sla_dias_uteis: 2 }),
  ]);
  assert.deepEqual(problemas, []);
  assert.equal(temErro(problemas), false);
});

test('acusa código repetido', () => {
  const p = validarCatalogo([et('exames', 0), et('exames', 1)]);
  assert.ok(p.some((x) => /repetido/.test(x.texto)));
  assert.equal(temErro(p), true);
});

test('acusa dependência para código inexistente', () => {
  const p = validarCatalogo([et('aso', 0, { depende_de: 'exames' })]);
  assert.ok(p.some((x) => /não existe/.test(x.texto)));
  assert.equal(temErro(p), true);
});

test('acusa auto-dependência', () => {
  const p = validarCatalogo([et('aso', 0, { depende_de: 'aso' })]);
  assert.ok(p.some((x) => /ela mesma/.test(x.texto)));
});

// Basta trocar o predecessor de dois passos sem olhar o outro.
test('acusa ciclo A -> B -> A', () => {
  const p = validarCatalogo([
    et('a', 0, { depende_de: 'b' }),
    et('b', 1, { depende_de: 'a' }),
  ]);
  const ciclos = p.filter((x) => /ciclo/.test(x.texto));
  assert.equal(ciclos.length, 2, 'as duas pontas do ciclo são apontadas');
  assert.equal(temErro(p), true);
});

test('acusa ciclo de três', () => {
  const p = validarCatalogo([
    et('a', 0, { depende_de: 'c' }),
    et('b', 1, { depende_de: 'a' }),
    et('c', 2, { depende_de: 'b' }),
  ]);
  assert.equal(p.filter((x) => /ciclo/.test(x.texto)).length, 3);
});

// A árvore real de MOB.PESSOAS: treinamento pende da abertura, ASO pende dos
// exames. Não é uma fila, e a validação não pode exigir que seja.
test('árvore com dois ramos é válida', () => {
  const p = validarCatalogo([
    et('abertura', 1),
    et('exames', 2, { depende_de: 'abertura' }),
    et('aso', 3, { depende_de: 'exames' }),
    et('treinamentos', 4, { depende_de: 'abertura' }),
  ]);
  assert.deepEqual(p, []);
});

test('predecessor depois na lista é aviso, não erro', () => {
  const p = validarCatalogo([
    et('aso', 0, { depende_de: 'exames' }),
    et('exames', 1),
  ]);
  assert.equal(p.length, 1);
  assert.equal(p[0].nivel, 'aviso');
  assert.equal(temErro(p), false, 'o recálculo do banco aguenta; só confunde a leitura');
});

test('acusa etapa sem título e SLA inválido', () => {
  const p = validarCatalogo([
    et('a', 0, { titulo: '  ' }),
    et('b', 1, { sla_dias_uteis: -3 }),
    et('c', 2, { sla_dias_uteis: 'sete' }),
  ]);
  assert.ok(p.some((x) => /sem título/.test(x.texto)));
  assert.equal(p.filter((x) => /não negativo/.test(x.texto)).length, 2);
});

test('SLA em branco é legítimo — nem toda etapa tem prazo', () => {
  assert.deepEqual(validarCatalogo([et('a', 0, { sla_dias_uteis: null })]), []);
  assert.deepEqual(validarCatalogo([et('a', 0, { sla_dias_uteis: '' })]), []);
  assert.deepEqual(validarCatalogo([et('a', 0, { sla_dias_uteis: 0 })]), [],
    'zero é o SLA da etapa raiz, e é válido');
});

test('sugere código a partir do título', () => {
  assert.equal(codigoDoTitulo('Emissão do ASO'), 'emissao_do_aso');
  assert.equal(codigoDoTitulo('Alteração contratual / CLT'), 'alteracao_contratual_clt');
  assert.equal(codigoDoTitulo('  Envio do dossiê  '), 'envio_do_dossie');
  assert.equal(codigoDoTitulo(''), '');
});
