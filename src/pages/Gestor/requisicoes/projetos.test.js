import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarCodigo, criarResolvedorProjeto, nomeProjeto, funcaoDaRequisicao, agruparPorProjeto,
} from './projetos.js';

test('normaliza o código e descarta o que não é código', () => {
  assert.equal(normalizarCodigo('  admb-ct27 '), 'ADMB-CT27');
  assert.equal(normalizarCodigo('Engenharia  Digital'), 'ENGENHARIA DIGITAL');
  for (const v of ['N/A', 'n/a', '-', '', null, undefined, 'Não se aplica']) {
    assert.equal(normalizarCodigo(v), null, String(v));
  }
});

test('nome do projeto: código completo do organograma e cliente pela sigla', () => {
  const resolver = criarResolvedorProjeto({
    obras: [
      { cod_phd: 'ADMB-CT27-DESC', cod_ct: 'ADMB-CT27' },
      { cod_phd: 'AURA-CT07-ENBH', cod_ct: 'AURA-CT07' },
    ],
    projetos: [
      { nome: 'ADMB-CT25-GERE', cliente: 'ADM DO BRASIL', origem_cod_phd: 'ADMB-CT25-GERE' },
      { nome: 'PBI-ADMB-CT10-GERMS', cliente: 'ADM do Brasil', origem_cod_phd: null },
      { nome: 'AURA-CT07-ENBH', cliente: null, origem_cod_phd: 'AURA-CT07-ENBH' },
    ],
  });
  assert.deepEqual(resolver('ADMB-CT27'), { completo: 'ADMB-CT27-DESC', cliente: 'ADM DO BRASIL' });
  // Já digitado completo: não repete o código.
  assert.deepEqual(resolver('aura-ct07-enbh'), { completo: null, cliente: null });
  assert.deepEqual(resolver('Engenharia Digital'), { completo: null, cliente: null });
  assert.equal(nomeProjeto(resolver('ADMB-CT27')), 'ADM DO BRASIL · ADMB-CT27-DESC');
  assert.equal(nomeProjeto(resolver('XYZ')), '');
});

test('sigla com dois clientes diferentes não chuta nome', () => {
  const resolver = criarResolvedorProjeto({
    projetos: [
      { nome: 'ABCD-CT01-X', cliente: 'Cliente Um' },
      { nome: 'ABCD-CT02-Y', cliente: 'Cliente Dois' },
    ],
  });
  assert.equal(resolver('ABCD-CT03').cliente, null);
});

test('função conforme o tipo da requisição', () => {
  assert.equal(funcaoDaRequisicao({ tipo: 'formulario_contratacao' }, { cargo_nivel: ' Analista ' }), 'Analista');
  assert.equal(funcaoDaRequisicao({ tipo: 'nova_vaga' }, { funcao: 'Técnico' }), 'Técnico');
  assert.equal(funcaoDaRequisicao({ tipo: 'aumento_salario', funcao_proposta: 'Sênior', colaborador: { funcao: 'Pleno' } }), 'Sênior');
  assert.equal(funcaoDaRequisicao({ tipo: 'desligamento', colaborador: { funcao: 'Pleno' } }), 'Pleno');
  assert.equal(funcaoDaRequisicao({ tipo: 'desligamento', colaborador: null }), null);
});

test('agrupa contratações do mesmo projeto no lugar da mais recente', () => {
  const lista = [
    { id: 1, tipo: 'formulario_contratacao' },
    { id: 2, tipo: 'desligamento' },
    { id: 3, tipo: 'formulario_contratacao' },
    { id: 4, tipo: 'formulario_contratacao' },
    { id: 5, tipo: 'formulario_contratacao' },
  ];
  const det = {
    1: { codigo_proposta_projeto: 'ADMB-CT27' },
    3: { codigo_proposta_projeto: 'admb-ct27 ' },
    4: { codigo_proposta_projeto: 'AURA-CT07' }, // sozinho: card comum
    5: { codigo_proposta_projeto: 'N/A' },       // sem código: card comum
  };
  const out = agruparPorProjeto(lista, det);
  assert.deepEqual(out.map((i) => (i.tipo === 'grupo' ? `g:${i.chave}` : i.sol.id)), ['g:ADMB-CT27', 2, 4, 5]);
  assert.equal(out[0].codigo, 'ADMB-CT27');
  assert.deepEqual(out[0].sols.map((s) => s.id), [1, 3]);
});
