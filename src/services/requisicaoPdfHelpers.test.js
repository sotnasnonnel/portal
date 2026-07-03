import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATUS_LABEL, nomeArquivoRequisicao, linhasDiretas } from './requisicaoPdfHelpers.js';

test('STATUS_LABEL mapeia os status conhecidos', () => {
  assert.equal(STATUS_LABEL.pendente, 'Em andamento');
  assert.equal(STATUS_LABEL.concluida, 'Concluída');
  assert.equal(STATUS_LABEL.reprovada, 'Reprovada');
});

test('nomeArquivoRequisicao sanitiza nome e usa a data (AAAA-MM-DD)', () => {
  const nome = nomeArquivoRequisicao(
    { tipo: 'ajuda_custo', created_at: '2026-07-01T12:00:00+00:00' },
    'João da Silva',
  );
  assert.match(nome, /^Requisicao_.+_JoaodaSilva_2026-07-01\.pdf$/);
  assert.ok(!/[ /à-ÿ]/.test(nome), 'sem espaços/acentos/barras');
});

test('nomeArquivoRequisicao tem defaults quando faltam dados', () => {
  const nome = nomeArquivoRequisicao({}, '');
  assert.match(nome, /^Requisicao_.+_Colaborador_0000-00-00\.pdf$/);
});

test('linhasDiretas monta as linhas de aumento_salario (só preenchidos)', () => {
  const linhas = linhasDiretas({
    tipo: 'aumento_salario',
    salario_proposto: 9500,
    funcao_proposta: 'ANALISTA',
    cargo_proposto: null,
    justificativa: 'merecimento',
    colaborador: { salario: 8000 },
  });
  const mapa = Object.fromEntries(linhas);
  assert.ok('Valor atual' in mapa);
  assert.ok('Valor proposto' in mapa);
  assert.equal(mapa['Função proposta'], 'ANALISTA');
  assert.ok(!('Cargo proposto' in mapa));
  assert.equal(mapa['Justificativa'], 'merecimento');
});

test('linhasDiretas monta as linhas de desligamento a partir da justificativa', () => {
  const just = 'Data solicitada para desligamento: 10/07/2026\n\nJustificativa: reestruturação';
  const linhas = linhasDiretas({ tipo: 'desligamento', justificativa: just });
  const mapa = Object.fromEntries(linhas);
  assert.equal(mapa['Data sugerida para desligamento'], '10/07/2026');
  assert.equal(mapa['Justificativa'], 'reestruturação');
});
