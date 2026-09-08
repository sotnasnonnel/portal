import test from 'node:test';
import assert from 'node:assert/strict';
import { _internos } from './lazyPagina.js';

const { ehArquivoQueSumiu } = _internos;

// A recarga automática só pode disparar quando o arquivo da tela sumiu do
// servidor. Confundir isso com um erro de código faria o portal recarregar
// escondendo o defeito de quem precisa vê-lo.
test('reconhece a falha de arquivo que sumiu no deploy', () => {
  const reais = [
    new TypeError('Failed to fetch dynamically imported module: https://portal/assets/page-ABC.js'),
    new Error('error loading dynamically imported module'),
    new Error('Importing a module script failed.'),
  ];
  for (const erro of reais) assert.equal(ehArquivoQueSumiu(erro), true, erro.message);
});

test('erro de codigo dentro da tela nao vira recarga', () => {
  const outros = [
    new TypeError("Cannot read properties of undefined (reading 'nome')"),
    new Error('supabase: invalid api key'),
    new ReferenceError('x is not defined'),
  ];
  for (const erro of outros) assert.equal(ehArquivoQueSumiu(erro), false, erro.message);
});

test('nao quebra com erro vazio ou sem mensagem', () => {
  assert.equal(ehArquivoQueSumiu(null), false);
  assert.equal(ehArquivoQueSumiu(undefined), false);
  assert.equal(ehArquivoQueSumiu({}), false);
  assert.equal(ehArquivoQueSumiu('Failed to fetch dynamically imported module'), true);
});
