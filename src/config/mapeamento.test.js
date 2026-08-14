import test from 'node:test';
import assert from 'node:assert/strict';
import { podeGerarNovaVaga, mapeamentoEmAprovacao, prefillNovaVagaDeMapeamento } from './mapeamento.js';

const EU = '11111111-1111-1111-1111-111111111111';
const OUTRO = '22222222-2222-2222-2222-222222222222';
const mapa = (over = {}) => ({ tipo: 'mapeamento', status: 'pendente', gestor_id: EU, ...over });

test('podeGerarNovaVaga: o solicitante gera mesmo com o mapeamento ainda em andamento', () => {
  // Era o furo: 'concluida' só acontece quando o DP EXECUTA a etapa final, então
  // entre a aprovação da cadeia e a execução o botão não aparecia para ninguém.
  assert.equal(podeGerarNovaVaga(mapa({ status: 'pendente' }), EU), true);
  assert.equal(podeGerarNovaVaga(mapa({ status: 'concluida' }), EU), true);
});

test('podeGerarNovaVaga: fim de linha não gera vaga', () => {
  assert.equal(podeGerarNovaVaga(mapa({ status: 'reprovada' }), EU), false);
  assert.equal(podeGerarNovaVaga(mapa({ status: 'cancelada' }), EU), false);
});

test('podeGerarNovaVaga: só o solicitante (aprovador que abre o mapeamento não vê)', () => {
  assert.equal(podeGerarNovaVaga(mapa(), OUTRO), false);
  assert.equal(podeGerarNovaVaga(mapa(), null), false);
  assert.equal(podeGerarNovaVaga(mapa({ gestor_id: null }), null), false);
});

test('podeGerarNovaVaga: só vale para Mapeamento', () => {
  for (const tipo of ['nova_vaga', 'ajuda_custo', 'desligamento', 'formulario_contratacao']) {
    assert.equal(podeGerarNovaVaga(mapa({ tipo }), EU), false, `${tipo} não deveria gerar vaga`);
  }
});

test('mapeamentoEmAprovacao: só a concluída (executada pelo DP) está fora de aprovação', () => {
  assert.equal(mapeamentoEmAprovacao(mapa({ status: 'pendente' })), true);
  assert.equal(mapeamentoEmAprovacao(mapa({ status: 'concluida' })), false);
});

test('prefill: leva os campos com correspondência e ignora os monetários', () => {
  const p = prefillNovaVagaDeMapeamento({
    funcao: 'ENGENHEIRO', estado: 'MG', cidade: 'Belo Horizonte',
    conhecimentos_obrigatorios: 'NR-35', codigo_proposta_cliente: 'C-99',
    salario_base: 5000, ajuda_custo_moradia: 800,
  });
  assert.equal(p.funcao, 'ENGENHEIRO');
  assert.equal(p.estado_atuacao, 'MG');
  assert.equal(p.cidade_atuacao, 'Belo Horizonte');
  assert.equal(p.requisitos_obrigatorios, 'NR-35');   // renomeado entre os formulários
  assert.equal(p.codigo_cliente, 'C-99');
  // Valores têm semântica diferente na vaga (orçado/margem) — não são copiados.
  assert.equal('salario_proposto' in p, false);
  assert.equal('valor_orcado_contrato' in p, false);
});

test('prefill: campo ausente vira string vazia (não undefined no input controlado)', () => {
  const p = prefillNovaVagaDeMapeamento({});
  assert.equal(p.funcao, '');
  assert.equal(p.horario_trabalho, '');
});
