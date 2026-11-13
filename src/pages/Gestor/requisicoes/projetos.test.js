import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rotuloGrupo, nomeInformado,
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
  assert.deepEqual(resolver('ADMB-CT27'), { codigo: 'ADMB-CT27', completo: 'ADMB-CT27-DESC', cliente: 'ADM DO BRASIL' });
  // Já digitado completo: não repete o código.
  assert.deepEqual(resolver('aura-ct07-enbh'), { codigo: 'AURA-CT07-ENBH', completo: null, cliente: null });
  assert.deepEqual(resolver('Engenharia Digital'), { codigo: 'ENGENHARIA DIGITAL', completo: null, cliente: null });
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
  assert.deepEqual(out.map((i) => (i.tipo === 'grupo' ? `g:${i.chave}` : i.sol.id)), ['g:formulario_contratacao:ADMB-CT27', 2, 4, 5]);
  assert.equal(out[0].codigo, 'ADMB-CT27');
  assert.deepEqual(out[0].sols.map((s) => s.id), [1, 3]);
});

test('vagas agrupam pelo Código do Cliente, separadas das contratações', () => {
  const lista = [
    { id: 1, tipo: 'nova_vaga' },
    { id: 2, tipo: 'formulario_contratacao' },
    { id: 3, tipo: 'nova_vaga' },
    { id: 4, tipo: 'formulario_contratacao' },
  ];
  const det = {
    1: { codigo_cliente: 'AURA-CT07', nome_cliente: 'Aura Minerals' },
    2: { codigo_proposta_projeto: 'AURA-CT07' },
    3: { codigo_cliente: 'aura-ct07', nome_cliente: '' },
    4: { codigo_proposta_projeto: 'AURA-CT07' },
  };
  const out = agruparPorProjeto(lista, det);
  assert.deepEqual(out.map((i) => i.chave), ['nova_vaga:AURA-CT07', 'formulario_contratacao:AURA-CT07']);
  assert.equal(out[0].tipoReq, 'nova_vaga');
  assert.equal(out[0].nomeInformado, 'Aura Minerals');
  assert.equal(rotuloGrupo('nova_vaga', 8), '8 vagas');
  assert.equal(rotuloGrupo('formulario_contratacao', 1), '1 contratação');
  assert.equal(nomeInformado({ tipo: 'formulario_contratacao' }, { nome_cliente: 'X' }), null);
});

test('mapeamentos agrupam pelo Código da proposta/cliente, no grupo deles', () => {
  const lista = [
    { id: 1, tipo: 'mapeamento' },
    { id: 2, tipo: 'nova_vaga' },
    { id: 3, tipo: 'mapeamento' },
    { id: 4, tipo: 'mapeamento' },
    { id: 5, tipo: 'mapeamento' },
  ];
  const det = {
    1: { codigo_proposta_cliente: 'ADMB-CT27' },
    2: { codigo_cliente: 'ADMB-CT27' },         // mesmo projeto, outra etapa
    3: { codigo_proposta_cliente: ' admb-ct27' },
    4: { codigo_proposta_cliente: 'AURA-CT07' }, // sozinho: card comum
    5: { codigo_proposta_cliente: 'N/A' },       // sem código: card comum
  };
  const out = agruparPorProjeto(lista, det);
  assert.deepEqual(
    out.map((i) => (i.tipo === 'grupo' ? `g:${i.chave}` : i.sol.id)),
    ['g:mapeamento:ADMB-CT27', 2, 4, 5]
  );
  assert.equal(out[0].codigo, 'ADMB-CT27');
  assert.deepEqual(out[0].sols.map((s) => s.id), [1, 3]);
  // O mapeamento não tem campo de nome do cliente: o nome vem só do cadastro.
  assert.equal(out[0].nomeInformado, null);
  assert.equal(rotuloGrupo('mapeamento', 3), '3 mapeamentos');
  assert.equal(rotuloGrupo('mapeamento', 1), '1 mapeamento');
});

test('nome digitado na vaga entra só quando o cadastro não achou o cliente', () => {
  assert.equal(nomeProjeto({ codigo: 'AURA-CT07', completo: 'AURA-CT07-ENBH', cliente: null }, 'Aura Minerals'), 'Aura Minerals · AURA-CT07-ENBH');
  assert.equal(nomeProjeto({ codigo: 'ADMB', completo: null, cliente: 'ADM DO BRASIL' }, 'ADM'), 'ADM DO BRASIL');
  // Nome igual ao código, ou "N/A": não repete.
  assert.equal(nomeProjeto({ codigo: 'ENGENHARIA DIGITAL', completo: null, cliente: null }, 'Engenharia Digital'), '');
  assert.equal(nomeProjeto({ codigo: 'X-1', completo: null, cliente: null }, 'N/A'), '');
});
