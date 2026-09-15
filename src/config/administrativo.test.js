import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AREAS_ADMINISTRATIVO, areasAdministrativoDe, CLASSES_ADM,
} from './administrativo.js';
import { ESTOQUE_LIBERADOS } from './estoque.js';
import { MOBILIZACAO_LIBERADOS } from './mobilizacao.js';

/**
 * O card "Administrativo" da Home reúne três módulos com liberações DIFERENTES
 * (Chamados é aberto; Estoque e Mobilização seguem em lançamento restrito).
 *
 * O risco que estes testes cobrem é o de sempre nesse tipo de agrupamento:
 * alguém ganhar acesso a um módulo por tabela — porque o card passou a listar
 * os três sem perguntar a cada um se aquela pessoa entra.
 */

const quem = (email) => ({ email });
const slugs = (user) => areasAdministrativoDe(user).map((a) => a.slug);

test('quem não está liberado vê só Chamados', () => {
  assert.deepEqual(slugs(quem('ninguem@phdengenharia.eng.br')), ['chamados']);
});

test('o card não vaza Estoque nem Mobilização para quem não entra neles', () => {
  const lista = slugs(quem('ninguem@phdengenharia.eng.br'));
  assert.ok(!lista.includes('estoque'));
  assert.ok(!lista.includes('mobilizacao'));
});

test('quem está nas duas listas de liberados vê os três', () => {
  // Um e-mail que está nas duas listas de verdade, para o teste acompanhar o
  // cadastro em vez de fingir um caso que não existe.
  const nos2 = ESTOQUE_LIBERADOS.find((e) => MOBILIZACAO_LIBERADOS.includes(e));
  assert.ok(nos2, 'esperava alguém liberado nos dois módulos');
  assert.deepEqual(slugs(quem(nos2)), ['chamados', 'estoque', 'mobilizacao']);
});

test('usuário sem e-mail (sessão a meio carregar) não quebra e não libera nada além do aberto', () => {
  assert.deepEqual(slugs(undefined), ['chamados']);
  assert.deepEqual(slugs({}), ['chamados']);
});

test('toda área do card aponta para uma rota e sabe dizer quem entra', () => {
  for (const a of AREAS_ADMINISTRATIVO) {
    assert.equal(typeof a.pode, 'function', `${a.slug} sem gate`);
    assert.match(a.href, /^\//, `${a.slug} sem rota`);
    assert.ok(a.label && a.desc && a.cta, `${a.slug} sem texto de cartão`);
  }
});

test('o catálogo de chamados continua de pé (o card novo não mexeu nele)', () => {
  assert.ok(CLASSES_ADM.length >= 10);
  assert.ok(CLASSES_ADM.every((c) => c.servicos?.length));
});
