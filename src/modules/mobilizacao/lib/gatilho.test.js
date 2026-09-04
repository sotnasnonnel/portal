import test from 'node:test';
import assert from 'node:assert/strict';
import { MOVIMENTOS } from '../../administrativo/app/novo/formularios/mobilizacao.js';
import { fluxoDoMovimento, dadosDoChamado, CLASSE_GATILHO } from './gatilho.js';

test('cada movimento do Adm cai num fluxo', () => {
  assert.equal(fluxoDoMovimento('Nova mobilização'), 'mobilizacao_pessoa');
  assert.equal(fluxoDoMovimento('Movimentação de profissional'), 'mobilizacao_pessoa');
  assert.equal(fluxoDoMovimento('Desmobilização'), 'desmobilizacao_pessoa');
});

/**
 * O teste que realmente importa: um movimento novo no Administrativo passaria
 * calado, porque o gatilho no banco registra a falha e segue (para nunca
 * impedir a abertura de um chamado). Aqui ele quebra o build.
 *
 * Importa direto de formularios/mobilizacao.js — que não tem imports, de
 * propósito, e por isso roda sob `node --test`.
 */
test('nenhum movimento do Adm fica sem fluxo mapeado', () => {
  const orfaos = MOVIMENTOS.filter((m) => !fluxoDoMovimento(m));
  assert.deepEqual(orfaos, [],
    'movimento novo no Administrativo precisa de fluxo aqui E em mob_fluxo_do_movimento (SQL)');
});

test('movimento desconhecido devolve null, e não um chute', () => {
  assert.equal(fluxoDoMovimento('Qualquer outra coisa'), null);
  assert.equal(fluxoDoMovimento(''), null);
  assert.equal(fluxoDoMovimento(undefined), null);
});

test('a classe do catálogo do Adm que dispara o módulo', () => {
  assert.equal(CLASSE_GATILHO, 'mobilizacao');
});

test('traduz os campos do chamado para o processo', () => {
  const dados = dadosDoChamado({
    movimento: 'Nova mobilização',
    profissional_id: 'uuid-1',
    profissional: 'GUILHERME DE ASSIS BRAGA',
    gestor: 'PAULO PAIVA',
    cc: 'IMCS-CT08',
    local_obra: 'NOVA LIMA',
    data_inicio_cliente: '2026-09-01',
    contato_cliente: 'fulano@cliente',
  });

  assert.equal(dados.profissional_nome, 'GUILHERME DE ASSIS BRAGA');
  assert.equal(dados.cod_ct, 'IMCS-CT08');
  assert.equal(dados.ger_phd, 'PAULO PAIVA');
  assert.equal(dados.data_base, '2026-09-01', 'a data de início vira a data-base do processo');
  assert.equal(dados.movimento, 'Nova mobilização', 'o movimento viaja para a condição do catálogo');
});

// Desmobilização não preenche obra, CC nem data — e campo vazio não pode virar
// string vazia no processo, senão o filtro por CC passa a ter uma opção "".
test('campo vazio não viaja', () => {
  const dados = dadosDoChamado({
    movimento: 'Desmobilização',
    profissional_id: 'uuid-1',
    profissional: 'HUDSON JUAN',
    cc: '',
    local_obra: '',
    data_inicio_cliente: '',
  });
  assert.deepEqual(Object.keys(dados).sort(),
    ['movimento', 'profissional_id', 'profissional_nome']);
});

test('campos desconhecidos do chamado são ignorados', () => {
  const dados = dadosDoChamado({ equipamentos: ['Notebook'], softwares: ['AutoCAD'], epis: [] });
  assert.deepEqual(dados, {},
    'os adicionais viram chamados-filhos no Adm; aqui não têm o que fazer');
});
