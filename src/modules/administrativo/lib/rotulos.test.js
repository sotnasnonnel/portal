import test from 'node:test';
import assert from 'node:assert/strict';
import { contextoDoChamado } from './rotulos.js';

// O caso que motivou tudo: classe de serviço único, em que os três textos são
// o mesmo. A tela mostrava "Solicitação de compra · Solicitação de compra".
test('classe de serviço único não repete o título', () => {
  assert.equal(contextoDoChamado({
    classeLabel: 'Solicitação de compra',
    servicoLabel: 'Solicitação de compra',
    assunto: 'Solicitação de compra',
  }), '');
});

test('classe diferente do assunto continua aparecendo', () => {
  assert.equal(contextoDoChamado({
    classeLabel: 'Manutenção & Instalação TI',
    servicoLabel: 'Liberação de acessos',
    assunto: 'Liberação de acessos',
  }), 'Manutenção & Instalação TI');
});

// Mobilização tira o assunto do seletor, então serviço e assunto divergem e os
// dois carregam informação.
test('quando assunto, classe e serviço diferem, mostra os dois', () => {
  assert.equal(contextoDoChamado({
    classeLabel: 'Mobilização',
    servicoLabel: 'Mobilização de profissional',
    assunto: 'Nova mobilização',
  }), 'Mobilização · Mobilização de profissional');
});

test('acento e caixa não enganam a comparação', () => {
  assert.equal(contextoDoChamado({
    classeLabel: 'CORREIO', servicoLabel: 'Correio', assunto: 'correio',
  }), '');
});

test('classe igual ao serviço aparece uma vez só', () => {
  assert.equal(contextoDoChamado({
    classeLabel: 'Uber', servicoLabel: 'Uber', assunto: 'Viagem',
  }), 'Uber');
});

test('faltando dado, devolve o que dá sem quebrar', () => {
  assert.equal(contextoDoChamado({ classeLabel: 'Frota' }), 'Frota');
  assert.equal(contextoDoChamado({}), '');
  assert.equal(contextoDoChamado(), '');
});

// String vazia não pode "casar" com assunto vazio e sumir com a linha inteira.
test('vazio não conta como igual', () => {
  assert.equal(contextoDoChamado({
    classeLabel: 'Frota', servicoLabel: '', assunto: '',
  }), 'Frota');
});
