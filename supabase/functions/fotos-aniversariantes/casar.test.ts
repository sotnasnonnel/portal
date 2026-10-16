import { test } from 'node:test';
import assert from 'node:assert/strict';
import { casarFotos } from './casar.ts';

const hub = (full_name: string) => ({ full_name, foto_path: `${full_name}.jpg` });

test('nome curto do hub casa com o nome completo do DP', () => {
  const fotos = casarFotos(
    [
      { id: 'iasmin', nome: 'IASMIN APARECIDA TEIXEIRA DOS SANTOS' },
      { id: 'paiva', nome: 'PAULO CEZAR DE PAIVA NETO' },
      { id: 'vinicius', nome: 'VINICIUS COSTA LIMA' },
    ],
    [hub('Iasmin Santos'), hub('Paulo Paiva'), hub('Vinícius Costa')],
  );
  assert.equal(fotos.get('iasmin'), 'Iasmin Santos.jpg');
  assert.equal(fotos.get('paiva'), 'Paulo Paiva.jpg');
  assert.equal(fotos.get('vinicius'), 'Vinícius Costa.jpg');
});

test('primeiro nome diferente não casa', () => {
  const fotos = casarFotos([{ id: 'a', nome: 'PAULO HENRIQUE COSTA ASSIS' }], [hub('Lucas Assis')]);
  assert.equal(fotos.size, 0);
});

test('nome do hub que serve para duas pessoas fica sem foto', () => {
  const fotos = casarFotos(
    [
      { id: 'a', nome: 'ANA REGINA CALDEIRA' },
      { id: 'b', nome: 'ANA PAULA CALDEIRA' },
    ],
    [hub('Ana Caldeira')],
  );
  assert.equal(fotos.size, 0);
});

test('pessoa que casa com dois nomes do hub fica sem foto', () => {
  const fotos = casarFotos(
    [{ id: 'a', nome: 'PEDRO HENRIQUE BRAGA DE MORAIS' }],
    [hub('Pedro Morais'), hub('Pedro Braga')],
  );
  assert.equal(fotos.size, 0);
});

test('só o primeiro nome não basta', () => {
  const fotos = casarFotos([{ id: 'a', nome: 'SISTEMAS PHD' }], [hub('Sistemas')]);
  assert.equal(fotos.size, 0);
});
