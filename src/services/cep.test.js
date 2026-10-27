import test from 'node:test';
import assert from 'node:assert/strict';
import { mascaraCep, soDigitosCep, cepValido, buscarCep } from './cep.js';

/** Resposta do ViaCEP, que sempre vem com status 200. */
const responde = (corpo, ok = true) => () => Promise.resolve({
  ok,
  json: () => Promise.resolve(corpo),
});

const comFetch = async (fake, fn) => {
  const original = globalThis.fetch;
  globalThis.fetch = fake;
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
};

test('máscara entra sozinha e ignora o que não é dígito', () => {
  assert.equal(mascaraCep('30140070'), '30140-070');
  assert.equal(mascaraCep('301'), '301');
  assert.equal(mascaraCep('30.140-070xx'), '30140-070');
  // Digitar além do oitavo dígito não cresce o campo.
  assert.equal(mascaraCep('301400709999'), '30140-070');
  assert.equal(soDigitosCep('30140-070'), '30140070');
  assert.ok(cepValido('30140-070'));
  assert.ok(!cepValido('30140'));
  assert.ok(!cepValido(''));
});

test('CEP incompleto não chega a consultar', async () => {
  await comFetch(
    () => assert.fail('não deveria consultar com CEP incompleto'),
    () => assert.rejects(buscarCep('3014'), /oito dígitos/),
  );
});

test('devolve rua, bairro, cidade e estado', async () => {
  const chamadas = [];
  const dados = await comFetch(
    (url) => { chamadas.push(url); return responde({
      logradouro: 'Rua das Acácias', bairro: 'Savassi', localidade: 'Belo Horizonte', uf: 'MG',
    })(); },
    () => buscarCep('30140-070'),
  );
  assert.deepEqual(dados, {
    logradouro: 'Rua das Acácias', bairro: 'Savassi', cidade: 'Belo Horizonte', uf: 'MG',
  });
  // A máscara não vai na URL.
  assert.equal(chamadas[0], 'https://viacep.com.br/ws/30140070/json/');
});

// A pegadinha do ViaCEP: CEP que não existe volta 200, e só o corpo acusa.
test('CEP inexistente acusa erro mesmo com status 200', async () => {
  await comFetch(
    responde({ erro: true }),
    () => assert.rejects(buscarCep('99999-999'), /não encontrado/i),
  );
});

test('serviço fora do ar vira recado para preencher à mão', async () => {
  await comFetch(
    () => Promise.reject(new Error('rede')),
    () => assert.rejects(buscarCep('30140-070'), /à mão/),
  );
  await comFetch(
    responde({}, false),
    () => assert.rejects(buscarCep('30140-070'), /à mão/),
  );
});

// CEP de logradouro único (cidade pequena) não tem rua nem bairro: vem string
// vazia, e não `undefined` — o campo continua controlado na tela.
test('campo ausente na resposta vira string vazia', async () => {
  const dados = await comFetch(
    responde({ localidade: 'Tapiraí', uf: 'SP' }),
    () => buscarCep('18180-000'),
  );
  assert.deepEqual(dados, { logradouro: '', bairro: '', cidade: 'Tapiraí', uf: 'SP' });
});
