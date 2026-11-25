import test from 'node:test';
import assert from 'node:assert/strict';
import {
  situacaoPorPessoa, filtrarPessoas, centrosDeCusto, contarPorSituacao, chaveDaPessoa,
} from './situacaoPessoas.js';

const mob = (extra = {}) => ({
  id: 'p1', numero: 1, fluxo: 'mobilizacao_pessoa', status: 'finalizado',
  profissional_nome: 'ANA SOUZA', local_obra: 'Obra Vale', cod_ct: 'CT-100',
  ger_phd: 'JULIO', cliente_phd: 'IMC', criado_em: '2026-01-10T10:00:00Z', ...extra,
});

test('uma pessoa com uma mobilização concluída aparece como mobilizada', () => {
  const [linha] = situacaoPorPessoa([mob()]);
  assert.equal(linha.nome, 'ANA SOUZA');
  assert.equal(linha.situacao, 'mobilizado');
  assert.equal(linha.cod_ct, 'CT-100');
});

// É a razão de a lista existir: por processo, quem trocou de obra apareceria duas vezes.
test('duas mobilizações da mesma pessoa viram UMA linha, com a obra mais recente', () => {
  const linhas = situacaoPorPessoa([
    mob({ id: 'a', local_obra: 'Obra antiga', criado_em: '2025-01-10T10:00:00Z' }),
    mob({ id: 'b', local_obra: 'Obra nova', criado_em: '2026-06-10T10:00:00Z' }),
  ]);
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].local_obra, 'Obra nova');
  assert.equal(linhas[0].processos, 2);
});

test('desmobilização mais recente vence a mobilização anterior', () => {
  const [linha] = situacaoPorPessoa([
    mob({ id: 'a', criado_em: '2026-01-10T10:00:00Z' }),
    mob({ id: 'b', fluxo: 'desmobilizacao_pessoa', criado_em: '2026-08-10T10:00:00Z' }),
  ]);
  assert.equal(linha.situacao, 'desmobilizado');
});

// A desmobilização não coleta obra nem CT: sem esta regra, a linha de quem saiu
// ficava vazia justamente nas colunas que dizem de onde ele saiu.
test('obra, CT e gestor vêm da última mobilização, mesmo quando o último processo é a saída', () => {
  const [linha] = situacaoPorPessoa([
    mob({ id: 'a', criado_em: '2026-01-10T10:00:00Z' }),
    mob({
      id: 'b', fluxo: 'desmobilizacao_pessoa', criado_em: '2026-08-10T10:00:00Z',
      local_obra: '', cod_ct: '', ger_phd: '',
    }),
  ]);
  assert.equal(linha.situacao, 'desmobilizado');
  assert.equal(linha.local_obra, 'Obra Vale');
  assert.equal(linha.cod_ct, 'CT-100');
  assert.equal(linha.ger_phd, 'JULIO');
});

test('processo em andamento distingue quem ainda está entrando ou saindo', () => {
  const [entrando] = situacaoPorPessoa([mob({ status: 'em_andamento' })]);
  assert.equal(entrando.situacao, 'em_mobilizacao');
  const [saindo] = situacaoPorPessoa([mob({ fluxo: 'desmobilizacao_pessoa', status: 'em_andamento' })]);
  assert.equal(saindo.situacao, 'em_desmobilizacao');
});

test('cancelado e mobilização de empresa ficam de fora', () => {
  assert.equal(situacaoPorPessoa([mob({ status: 'cancelado' })]).length, 0);
  assert.equal(situacaoPorPessoa([mob({ fluxo: 'mobilizacao_empresa', profissional_nome: '' })]).length, 0);
});

// Metade da base veio da planilha sem id de colaborador.
test('a mesma pessoa junta por id, e por nome quando não há id', () => {
  assert.equal(chaveDaPessoa({ profissional_id: 'uuid-1', profissional_nome: 'ANA' }), 'uuid-1');
  assert.equal(chaveDaPessoa({ profissional_nome: ' ana souza ' }), 'ANA SOUZA');
  const linhas = situacaoPorPessoa([
    mob({ id: 'a', profissional_nome: 'ana souza', criado_em: '2025-01-10T10:00:00Z' }),
    mob({ id: 'b', profissional_nome: 'ANA SOUZA', criado_em: '2026-01-10T10:00:00Z' }),
  ]);
  assert.equal(linhas.length, 1);
});

test('mobilizado vem antes de desmobilizado na ordenação', () => {
  const linhas = situacaoPorPessoa([
    mob({ id: 'a', profissional_nome: 'ZE', fluxo: 'desmobilizacao_pessoa' }),
    mob({ id: 'b', profissional_nome: 'ANA' }),
  ]);
  assert.deepEqual(linhas.map((l) => l.situacao), ['mobilizado', 'desmobilizado']);
});

test('filtro por texto, situação e CT', () => {
  const linhas = situacaoPorPessoa([
    mob({ id: 'a', profissional_nome: 'ANA', cod_ct: 'CT-100' }),
    mob({ id: 'b', profissional_nome: 'BRUNO', cod_ct: 'CT-200', local_obra: 'Obra Sul' }),
  ]);
  assert.equal(filtrarPessoas(linhas, { busca: 'sul' }).length, 1);
  assert.equal(filtrarPessoas(linhas, { ct: 'CT-100' })[0].nome, 'ANA');
  assert.equal(filtrarPessoas(linhas, { situacao: 'desmobilizado' }).length, 0);
  assert.equal(filtrarPessoas(linhas).length, 2);
});

test('centrosDeCusto lista os CTs distintos, e a contagem cobre as quatro situações', () => {
  const linhas = situacaoPorPessoa([
    mob({ id: 'a', profissional_nome: 'ANA', cod_ct: 'CT-100' }),
    mob({ id: 'b', profissional_nome: 'BRUNO', cod_ct: 'CT-100' }),
    mob({ id: 'c', profissional_nome: 'CARLA', cod_ct: '' }),
  ]);
  assert.deepEqual(centrosDeCusto(linhas), ['CT-100']);
  const contagem = contarPorSituacao(linhas);
  assert.equal(contagem.length, 4);
  assert.equal(contagem.find((c) => c.chave === 'mobilizado').total, 3);
});

// Conferência da planilha MOBILIZADOS PORTAL (25/11/2026): a carga da planilha
// não tem id, o que nasce no portal tem. Antes, a mesma pessoa virava duas
// linhas — uma "Mobilizado" e outra "Desmobilizado".
test('processo importado (só nome) e processo do portal (com id) são a mesma pessoa', () => {
  const linhas = situacaoPorPessoa([
    mob({ id: 'a', profissional_nome: 'Getúlio  Pedrosa', data_base: '2026-07-29' }),
    mob({
      id: 'b', fluxo: 'desmobilizacao_pessoa', profissional_id: 'uuid-g',
      profissional_nome: 'GETULIO PEDROSA', data_base: '2026-10-16',
    }),
  ]);
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].situacao, 'desmobilizado');
  assert.equal(linhas[0].processos, 2);
});

// Lucas Pedro: entra na Superus (CT novo) e só depois registram a saída da
// obra antiga. Ele está mobilizado na Superus, não desmobilizado.
test('desmobilização de OUTRA obra não tira a pessoa da obra atual', () => {
  const [linha] = situacaoPorPessoa([
    mob({ id: 'a', cod_ct: 'IMCS-CT09', data_base: '2026-04-06' }),
    mob({ id: 'b', profissional_id: 'u1', cod_ct: 'SUPE-CT01', local_obra: 'VARGEM GRANDE', data_base: '2026-10-26' }),
    mob({ id: 'c', profissional_id: 'u1', fluxo: 'desmobilizacao_pessoa', cod_ct: 'IMCS-CT09', data_base: '2026-10-28' }),
  ]);
  assert.equal(linha.situacao, 'mobilizado');
  assert.equal(linha.cod_ct, 'SUPE-CT01');
  assert.equal(linha.processoId, 'b');
});

// Hudson: mobilização nova em andamento + saída da obra antiga registrada depois.
test('mobilização nova em andamento continua "em mobilização" após a saída da obra antiga', () => {
  const [linha] = situacaoPorPessoa([
    mob({ id: 'a', cod_ct: 'GCES-CT01', data_base: '2026-03-09' }),
    mob({ id: 'b', profissional_id: 'u2', status: 'em_andamento', cod_ct: null, local_obra: 'Porteirão-GO', data_base: '2026-11-13', criado_em: '2026-10-26T10:00:00Z' }),
    mob({ id: 'c', profissional_id: 'u2', fluxo: 'desmobilizacao_pessoa', cod_ct: 'GCES-CT01', data_base: '2026-11-13', criado_em: '2026-10-30T10:00:00Z' }),
  ]);
  assert.equal(linha.situacao, 'em_mobilizacao');
  assert.equal(linha.local_obra, 'Porteirão-GO');
});

// A carga criou todos os processos no mesmo dia: a ordem tem de vir da data-base.
test('a obra atual é a da data-base mais recente, não a da criação', () => {
  const [linha] = situacaoPorPessoa([
    mob({ id: 'a', cod_ct: 'VALE-CT05', data_base: '2026-07-31', criado_em: '2026-09-09T10:00:00Z' }),
    mob({ id: 'b', cod_ct: 'ADMB-CT16', data_base: '2026-07-14', criado_em: '2026-09-09T10:00:01Z' }),
  ]);
  assert.equal(linha.cod_ct, 'VALE-CT05');
});

test('volta para a mesma obra depois da saída: mobilizado de novo', () => {
  const [linha] = situacaoPorPessoa([
    mob({ id: 'a', data_base: '2026-01-10' }),
    mob({ id: 'b', fluxo: 'desmobilizacao_pessoa', data_base: '2026-03-10' }),
    mob({ id: 'c', data_base: '2026-06-10' }),
  ]);
  assert.equal(linha.situacao, 'mobilizado');
  assert.equal(linha.processoId, 'c');
});
