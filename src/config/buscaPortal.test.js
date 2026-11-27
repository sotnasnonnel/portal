import test from 'node:test';
import assert from 'node:assert/strict';
import { buscarNoIndice, normalizar, semRepetidos } from './buscaPortal.js';

const indice = [
  { titulo: 'Financeiro', onde: 'Módulo', tipo: 'modulo', href: '/financeiro', termos: 'cartão clara' },
  { titulo: 'Dashboard', onde: 'Financeiro · Reembolsos', tipo: 'tela', href: '/reembolsos/dashboard' },
  { titulo: 'Dashboard', onde: 'Dados · Solicitações', tipo: 'tela', href: '/solic/dashboard' },
  { titulo: 'Reserva de veículos', onde: 'Atendimento · Gestão de frota', tipo: 'chamado', href: '/administrativo/novo/frota/reserva-veiculos' },
  { titulo: 'Ausência Programada', onde: 'Gestão de Pessoas', tipo: 'modulo', href: '/ausencia-programada', termos: 'férias folga' },
  { titulo: 'Clara', onde: 'Soluções Integradas', tipo: 'externo', url: 'https://clara' },
];

test('normalizar tira acento e caixa', () => {
  assert.equal(normalizar('  Manutenção  '), 'manutencao');
  assert.equal(normalizar(null), '');
});

test('busca vazia não devolve nada', () => {
  assert.deepEqual(buscarNoIndice(indice, '   '), []);
});

test('acha palavra a palavra, sem acento, também pelo caminho', () => {
  assert.deepEqual(buscarNoIndice(indice, 'reserva veiculo').map((e) => e.href), ['/administrativo/novo/frota/reserva-veiculos']);
  assert.deepEqual(buscarNoIndice(indice, 'dashboard reembolso').map((e) => e.href), ['/reembolsos/dashboard']);
});

test('acha pelo apelido', () => {
  assert.equal(buscarNoIndice(indice, 'ferias')[0].titulo, 'Ausência Programada');
});

test('título antes de apelido, e o do portal antes do link de fora', () => {
  // "clara": título do externo (nota 0) vence o apelido do módulo (nota 4).
  assert.deepEqual(buscarNoIndice(indice, 'clara').map((e) => e.titulo), ['Clara', 'Financeiro']);
  // "fin": começo do título do módulo.
  assert.equal(buscarNoIndice(indice, 'fin')[0].titulo, 'Financeiro');
});

test('respeita o máximo', () => {
  assert.equal(buscarNoIndice(indice, 'a', 2).length, 2);
});

test('semRepetidos junta pelo destino e guarda o outro nome como apelido', () => {
  const lista = semRepetidos([
    { titulo: 'Apontamento', onde: 'Gestão de Horas', href: '/horas/apontar' },
    { titulo: 'Apontar', onde: 'Gestão de Horas · Apontamento', href: '/horas/apontar' },
    { titulo: 'Sem destino' },
  ]);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].titulo, 'Apontamento');
  assert.match(lista[0].termos, /Apontar/);
});
