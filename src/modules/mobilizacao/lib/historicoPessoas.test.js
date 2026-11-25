import test from 'node:test';
import assert from 'node:assert/strict';
import {
  movimentosDePessoas, filtrarMovimentos, opcoes, resumoMovimentos,
} from './historicoPessoas.js';

const proc = (extra = {}) => ({
  id: 'p1', numero: 1, fluxo: 'mobilizacao_pessoa', status: 'finalizado',
  profissional_nome: 'ANA SOUZA', local_obra: 'Obra Vale', cod_ct: 'VALE-CT01',
  cliente_phd: 'VALE', ger_phd: 'JULIO', data_base: '2026-01-10',
  criado_em: '2026-01-10T10:00:00Z', origem: 'planilha', ...extra,
});

test('uma linha por movimento, do mais recente para o mais antigo', () => {
  const linhas = movimentosDePessoas([
    proc({ id: 'a', data_base: '2026-01-10' }),
    proc({ id: 'b', fluxo: 'desmobilizacao_pessoa', data_base: '2026-05-10', origem: 'portal' }),
    proc({ id: 'c', fluxo: 'mobilizacao_empresa', profissional_nome: '' }),
  ]);
  assert.deepEqual(linhas.map((l) => l.id), ['b', 'a']);
  assert.equal(linhas[0].tipo, 'desmobilizacao');
  assert.equal(linhas[0].origem, 'Portal');
  assert.equal(linhas[1].origem, 'Planilha');
});

test('processo da planilha (só nome) e do portal (com id) são a mesma pessoa', () => {
  const linhas = movimentosDePessoas([
    proc({ id: 'a', profissional_nome: 'Ana  Souza' }),
    proc({ id: 'b', fluxo: 'desmobilizacao_pessoa', profissional_id: 'u1', data_base: '2026-05-10' }),
  ]);
  assert.equal(linhas[0].chave, linhas[1].chave);
  assert.equal(linhas[0].movimentos, 2);
  assert.equal(linhas[0].situacaoAtual, 'desmobilizado');
});

test('desmobilização sem data-base usa o dia em que entrou no portal', () => {
  const [l] = movimentosDePessoas([
    proc({ fluxo: 'desmobilizacao_pessoa', data_base: null, criado_em: '2026-11-25T13:00:00Z' }),
  ]);
  assert.equal(l.data, '2026-11-25');
});

test('cancelado fica fora por padrão e volta com "todos"', () => {
  const linhas = movimentosDePessoas([proc({ id: 'a' }), proc({ id: 'b', status: 'cancelado', data_base: '2026-02-01' })]);
  assert.equal(filtrarMovimentos(linhas).length, 1);
  assert.equal(filtrarMovimentos(linhas, { status: 'todos' }).length, 2);
  assert.equal(filtrarMovimentos(linhas, { status: 'cancelado' })[0].id, 'b');
});

test('filtros por tipo, CT, cliente, pessoa, período e busca sem acento', () => {
  const linhas = movimentosDePessoas([
    proc({ id: 'a', profissional_nome: 'ANA', data_base: '2026-01-10' }),
    proc({ id: 'b', profissional_nome: 'BRUNO', cod_ct: 'GERD-CT14', cliente_phd: 'GERDAU', local_obra: 'Pindamonhangaba', data_base: '2026-06-10' }),
    proc({ id: 'c', profissional_nome: 'BRUNO', fluxo: 'desmobilizacao_pessoa', cod_ct: 'GERD-CT14', cliente_phd: 'GERDAU', data_base: '2026-09-10' }),
  ]);
  assert.equal(filtrarMovimentos(linhas, { tipo: 'desmobilizacao' }).length, 1);
  assert.equal(filtrarMovimentos(linhas, { ct: 'GERD-CT14' }).length, 2);
  assert.equal(filtrarMovimentos(linhas, { cliente: 'VALE' })[0].id, 'a');
  assert.equal(filtrarMovimentos(linhas, { pessoa: linhas[0].chave }).length, 2);
  assert.deepEqual(filtrarMovimentos(linhas, { de: '2026-06-10', ate: '2026-06-10' }).map((l) => l.id), ['b']);
  assert.equal(filtrarMovimentos(linhas, { busca: 'pindamonhangabá' }).length, 1);
});

test('opções e resumo', () => {
  const linhas = movimentosDePessoas([
    proc({ id: 'a', profissional_nome: 'ANA' }),
    proc({ id: 'b', profissional_nome: 'ANA', fluxo: 'desmobilizacao_pessoa', data_base: '2026-03-01' }),
    proc({ id: 'c', profissional_nome: 'BRUNO', cod_ct: 'GERD-CT14' }),
  ]);
  assert.deepEqual(opcoes(linhas, 'cod_ct'), ['GERD-CT14', 'VALE-CT01']);
  assert.deepEqual(resumoMovimentos(linhas), { total: 3, mobilizacoes: 2, desmobilizacoes: 1, pessoas: 2 });
});
