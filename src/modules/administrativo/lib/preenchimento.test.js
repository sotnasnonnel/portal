import { test } from 'node:test';
import assert from 'node:assert/strict';
import { valoresDaUrl } from './preenchimento.js';

test('troca de equipamentos: série e tipo vêm da URL', () => {
  const p = new URLSearchParams('numero_serie=PE07L7VA&tipo=Notebook');
  assert.deepEqual(valoresDaUrl('ti', 'troca-equipamentos', p), { numero_serie: 'PE07L7VA', tipo: 'Notebook' });
});

test('a URL não cria opção nem campo', () => {
  const p = new URLSearchParams('tipo=Tablet&inventado=x&motivo=Roubo');
  assert.deepEqual(valoresDaUrl('ti', 'troca-equipamentos', p), {});
});

test('serviço sem esquema não recebe nada', () => {
  assert.deepEqual(valoresDaUrl('nao', 'existe', new URLSearchParams('a=1')), {});
});
