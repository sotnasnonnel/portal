import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mascaraCep, cepValido, faltasEndereco, enderecoCompleto, formatarEnderecoEntrega, ENDERECO_VAZIO,
} from './endereco.js';

const COMPLETO = {
  cep: '30140-070',
  logradouro: 'Rua das Acácias',
  numero: '120',
  complemento: 'Apto 302',
  bairro: 'Savassi',
  cidade: 'Belo Horizonte',
  uf: 'MG',
};

test('máscara do CEP entra sozinha e ignora o que não é dígito', () => {
  assert.equal(mascaraCep('30140070'), '30140-070');
  assert.equal(mascaraCep('301'), '301');
  assert.equal(mascaraCep('30.140-070xx'), '30140-070');
  assert.ok(cepValido('30140-070'));
  assert.ok(!cepValido('30140'));
});

test('endereço vazio acusa todos os obrigatórios, menos o complemento', () => {
  assert.deepEqual(
    faltasEndereco(ENDERECO_VAZIO),
    ['cep', 'logradouro', 'numero', 'bairro', 'cidade', 'uf']
  );
  assert.ok(!enderecoCompleto(ENDERECO_VAZIO));
});

test('complemento é opcional', () => {
  assert.ok(enderecoCompleto({ ...COMPLETO, complemento: '' }));
});

test('formata em 3 linhas para o Financeiro ler', () => {
  assert.equal(
    formatarEnderecoEntrega(COMPLETO),
    'Rua das Acácias, 120 — Apto 302\nSavassi\nBelo Horizonte/MG — CEP 30140-070'
  );
  assert.equal(
    formatarEnderecoEntrega({ ...COMPLETO, complemento: '' }),
    'Rua das Acácias, 120\nSavassi\nBelo Horizonte/MG — CEP 30140-070'
  );
});
