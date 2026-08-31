import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ordemTamanho, detalheVariante, rotuloVariante, chaveVariante,
  situacaoDoSaldo, compararVariantes, filtrarPosicao, normalizar,
} from './catalogo.js';

test('ordemTamanho põe vestuário na ordem da tabela de medidas, não alfabética', () => {
  const ordenado = ['GG', 'P', 'XXG', 'M', 'G', 'XG']
    .sort((a, b) => ordemTamanho(a) - ordemTamanho(b));
  assert.deepEqual(ordenado, ['P', 'M', 'G', 'GG', 'XG', 'XXG']);
});

test('ordemTamanho ordena calçado por número (39 antes de 41, não como texto)', () => {
  const ordenado = ['41', '39', '45', '37'].sort((a, b) => ordemTamanho(a) - ordemTamanho(b));
  assert.deepEqual(ordenado, ['37', '39', '41', '45']);
});

test('ordemTamanho: sem tamanho vem primeiro, desconhecido vai para o fim', () => {
  assert.equal(ordemTamanho(''), -1);
  assert.equal(ordemTamanho(null), -1);
  assert.ok(ordemTamanho('ÚNICO') > ordemTamanho('48'));
});

test('detalheVariante mostra só o que distingue a variante', () => {
  assert.equal(detalheVariante({ tamanho: '42', ca: '48582' }), '42 · CA 48582');
  assert.equal(
    detalheVariante({ tamanho: 'M', genero: 'feminino', setor: 'obra' }),
    'M · Feminino · Obra',
  );
  assert.equal(detalheVariante({}), '');
});

test('rotuloVariante sem atributos não deixa separador solto', () => {
  assert.equal(rotuloVariante({ descricao: 'MOCHILA' }), 'MOCHILA');
  assert.equal(
    rotuloVariante({ descricao: 'BOTINA COM METATARSO', tamanho: '42', ca: '48582' }),
    'BOTINA COM METATARSO · 42 · CA 48582',
  );
});

// O caso que motivou o CA fazer parte da chave: a planilha de EPIs traz
// RESPIRADOR COM VÁLVULA duas vezes, com CA 45021 e com CA 12011. Fundir os dois
// somaria o saldo de itens que não se substituem num laudo.
test('chaveVariante separa mesma descrição com CA diferente', () => {
  const a = { categoria: 'epi', descricao: 'RESPIRADOR COM VÁLVULA ', ca: '45021' };
  const b = { categoria: 'epi', descricao: 'RESPIRADOR COM VÁLVULA', ca: '12011' };
  assert.notEqual(chaveVariante(a), chaveVariante(b));
});

test('chaveVariante ignora acento, caixa e espaço extra', () => {
  assert.equal(
    chaveVariante({ categoria: 'uniforme', descricao: 'Camisa social Branca ' }),
    chaveVariante({ categoria: 'uniforme', descricao: 'CAMISA  SOCIAL BRANCA' }),
  );
});

test('chaveVariante separa uniforme por gênero e setor', () => {
  const base = { categoria: 'uniforme', descricao: 'Camisa Polo', tamanho: 'M' };
  assert.notEqual(
    chaveVariante({ ...base, genero: 'masculino', setor: 'sede' }),
    chaveVariante({ ...base, genero: 'feminino', setor: 'sede' }),
  );
  assert.notEqual(
    chaveVariante({ ...base, genero: 'masculino', setor: 'sede' }),
    chaveVariante({ ...base, genero: 'masculino', setor: 'obra' }),
  );
});

test('situacaoDoSaldo espelha o CASE da view estoque_posicao', () => {
  assert.equal(situacaoDoSaldo({ saldo: 0, estoque_minimo: 3 }), 'sem_estoque');
  assert.equal(situacaoDoSaldo({ saldo: 2, estoque_minimo: 3 }), 'abaixo_minimo');
  assert.equal(situacaoDoSaldo({ saldo: 3, estoque_minimo: 3 }), 'ok');
  assert.equal(situacaoDoSaldo({ saldo: 9, estoque_minimo: 3, estoque_maximo: 5 }), 'acima_maximo');
  // Máximo em branco não pode virar 0 e classificar tudo como excesso.
  assert.equal(situacaoDoSaldo({ saldo: 9, estoque_minimo: 3, estoque_maximo: null }), 'ok');
  assert.equal(situacaoDoSaldo({ saldo: 9, estoque_minimo: 3, estoque_maximo: '' }), 'ok');
});

test('compararVariantes agrupa por item e ordena os tamanhos dentro dele', () => {
  const lista = [
    { categoria: 'epi', descricao: 'BOTINA', tamanho: '41' },
    { categoria: 'epi', descricao: 'CAPACETE' },
    { categoria: 'epi', descricao: 'BOTINA', tamanho: '37' },
  ];
  assert.deepEqual(
    [...lista].sort(compararVariantes).map((v) => `${v.descricao}${v.tamanho || ''}`),
    ['BOTINA37', 'BOTINA41', 'CAPACETE'],
  );
});

const POSICAO = [
  { categoria: 'epi', descricao: 'BOTINA COM METATARSO', tamanho: '42', ca: '48582', saldo: 0, situacao: 'sem_estoque' },
  { categoria: 'epi', descricao: 'CAPACETE 3M', ca: '29638', saldo: 5, situacao: 'ok' },
  { categoria: 'uniforme', descricao: 'Camisa Polo', tamanho: 'M', genero: 'masculino', saldo: 1, situacao: 'abaixo_minimo' },
];

test('filtrarPosicao casa termos soltos contra o rótulo inteiro', () => {
  assert.equal(filtrarPosicao(POSICAO, { termo: 'botina 42' }).length, 1);
  assert.equal(filtrarPosicao(POSICAO, { termo: '29638' })[0].descricao, 'CAPACETE 3M');
  // Sem acento e fora de ordem também precisa achar.
  assert.equal(filtrarPosicao(POSICAO, { termo: 'polo camisa' }).length, 1);
  assert.equal(filtrarPosicao(POSICAO, { termo: 'inexistente' }).length, 0);
});

test('filtrarPosicao combina categoria e alerta', () => {
  assert.equal(filtrarPosicao(POSICAO, { categoria: 'uniforme' }).length, 1);
  assert.equal(filtrarPosicao(POSICAO, { apenasAlerta: true }).length, 2);
  assert.equal(filtrarPosicao(POSICAO, { categoria: 'epi', apenasAlerta: true }).length, 1);
});

test('filtrarPosicao isola uma situação — o caminho do painel para cá', () => {
  assert.deepEqual(
    filtrarPosicao(POSICAO, { situacao: 'sem_estoque' }).map((v) => v.descricao),
    ['BOTINA COM METATARSO'],
  );
  assert.equal(filtrarPosicao(POSICAO, { situacao: 'ok' }).length, 1);
  assert.equal(filtrarPosicao(POSICAO, { situacao: 'acima_maximo' }).length, 0);
  // Combina com os outros filtros.
  assert.equal(filtrarPosicao(POSICAO, { situacao: 'sem_estoque', categoria: 'uniforme' }).length, 0);
});

test('filtrarPosicao devolve ordenado e aguenta lista vazia', () => {
  assert.deepEqual(filtrarPosicao(null, {}), []);
  assert.deepEqual(
    filtrarPosicao(POSICAO, {}).map((v) => v.descricao),
    ['BOTINA COM METATARSO', 'CAPACETE 3M', 'Camisa Polo'],
  );
});

test('normalizar colapsa espaços e remove acento', () => {
  assert.equal(normalizar('  ÓCULOS   DE  PROTEÇÃO '), 'oculos de protecao');
});
