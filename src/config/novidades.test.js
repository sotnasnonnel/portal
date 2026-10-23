import test from 'node:test';
import assert from 'node:assert/strict';
import { NOVIDADES, ULTIMA_NOVIDADE, novidadesNaoVistas, tutorialDasNovidades } from './novidades.js';
import { COMO_GANHAR } from './pontos.js';

const ids = (lista) => lista.map((v) => v.id);

test('novidades: quem nunca viu recebe só a última', () => {
  assert.deepEqual(ids(novidadesNaoVistas(null)), [ULTIMA_NOVIDADE.id]);
  assert.deepEqual(ids(novidadesNaoVistas(undefined)), [ULTIMA_NOVIDADE.id]);
  assert.deepEqual(ids(novidadesNaoVistas('')), [ULTIMA_NOVIDADE.id]);
});

test('novidades: quem viu a anterior recebe só a nova', () => {
  assert.deepEqual(ids(novidadesNaoVistas(NOVIDADES[1].id)), [NOVIDADES[0].id]);
});

test('novidades: quem viu a última não recebe nada', () => {
  assert.deepEqual(novidadesNaoVistas(ULTIMA_NOVIDADE.id), []);
});

test('novidades: id que não existe mais vale como nunca ter visto', () => {
  assert.deepEqual(ids(novidadesNaoVistas('2020-01-01-apagada')), [ULTIMA_NOVIDADE.id]);
});

test('novidades: o passo a passo é o da primeira versão que tiver um', () => {
  assert.equal(tutorialDasNovidades([]), null);
  assert.equal(tutorialDasNovidades(), null);
  assert.equal(tutorialDasNovidades([{ id: 'a', itens: [] }]), null);
  assert.equal(tutorialDasNovidades([
    { id: 'c', itens: [] },
    { id: 'b', tutorial: 'x', itens: [] },
    { id: 'a', tutorial: 'y', itens: [] },
  ]), 'x');
});

test('novidades: o lançamento do feed traz o passo a passo e os pontos da loja', () => {
  const feed = NOVIDADES.find((v) => v.id === '2026-10-23-feed');
  assert.equal(feed.tutorial, 'feed');
  // Quem tinha visto a versão anterior recebe o feed e, com ele, o passo a passo.
  assert.equal(tutorialDasNovidades(novidadesNaoVistas('2026-10-16-personalizacao')), 'feed');
  const pontos = COMO_GANHAR.find((g) => g.o === 'Postar no feed').p;
  assert.ok(feed.itens.some((i) => i.texto.includes(`+${pontos} pontos`)));
});

test('novidades: ids não se repetem', () => {
  assert.equal(new Set(ids(NOVIDADES)).size, NOVIDADES.length);
});
