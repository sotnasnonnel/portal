import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  agruparPorModelo, resumoPorPessoa, cpfValido, formatarCpf, pendenteTermo, pessoasComAtivos, resumoPainel, listaTermos,
} from './regras.js';

const a = (extra) => ({
  numero_serie: 'X', fornecedor: 'Selbet', tipo: 'Notebook', situacao: 'Em utilização',
  responsavel: 'fulano@phd.com.br', valor_mensal: '100.50', situacao_termo: 'Sem termo', ...extra,
});

test('pendência de termo: em uso, com e-mail e sem termo assinado', () => {
  assert.equal(pendenteTermo(a()), true);
  assert.equal(pendenteTermo(a({ situacao_termo: 'Assinado' })), false);
  assert.equal(pendenteTermo(a({ situacao: 'Recolhido' })), false);
  assert.equal(pendenteTermo(a({ responsavel: 'Não encontrado' })), false);
});

test('resumo do painel soma mensalidade por fornecedor (numeric chega como texto)', () => {
  const r = resumoPainel([a(), a({ fornecedor: 'EMC', valor_mensal: 50 }), a({ fornecedor: 'Próprio', valor_mensal: null })]);
  assert.equal(r.total, 3);
  assert.equal(r.mensal, 150.5);
  assert.deepEqual(r.fornecedores.map((f) => [f.fornecedor, f.quantidade, f.mensal]).sort(), [
    ['EMC', 1, 50], ['Próprio', 1, 0], ['Selbet', 1, 100.5],
  ]);
  assert.equal(r.pendentes, 3);
  assert.equal(r.responsaveisPendentes, 1);
});

test('resumo por modelo agrupa, conta e pega a configuração mais comum', () => {
  const g = agruparPorModelo([
    a({ modelo: 'Dell G15', configuracao: 'i7' }),
    a({ modelo: 'Dell G15', configuracao: 'i7' }),
    a({ modelo: 'Dell G15', configuracao: 'i5' }),
    a({ modelo: '' }),
  ]);
  assert.equal(g[0].modelo, 'Dell G15');
  assert.equal(g[0].quantidade, 3);
  assert.equal(g[0].configuracao, 'i7');
  assert.equal(g[1].modelo, 'Modelo não informado');
});

test('resumo por pessoa: uma linha por pessoa e modelo; parado fica sem ninguém', () => {
  const r = resumoPorPessoa([
    a({ modelo: 'Dell G15', responsavel: 'Fulano@phd.com.br' }),
    a({ modelo: 'Dell G15', responsavel: 'fulano@phd.com.br' }),
    a({ modelo: 'AOC 22', tipo: 'Monitor', responsavel: 'fulano@phd.com.br' }),
    a({ modelo: 'Dell G15', responsavel: 'ciclano@phd.com.br' }),
    a({ modelo: 'Dell G15', situacao: 'Em estoque', responsavel: 'beltrano@phd.com.br' }),
  ]);
  const linhas = r.map((l) => [l.email, l.modelo, l.quantidade]);
  assert.deepEqual(linhas, [
    ['fulano@phd.com.br', 'Dell G15', 2],
    ['fulano@phd.com.br', 'AOC 22', 1],
    ['ciclano@phd.com.br', 'Dell G15', 1],
    [null, 'Dell G15', 1],
  ]);
  assert.equal(r[0].mensal, 201);
});

test('pessoas: cadastro + responsáveis fora do cadastro; desligado sem equipamento sai', () => {
  const ps = pessoasComAtivos(
    [a({ responsavel: 'Fulano@PHD.com.br' }), a({ responsavel: 'ex@phd.com.br' })],
    [
      { email: 'fulano@phd.com.br', nome: 'Fulano', vinculo: 'CLT' },
      { email: 'saiu@phd.com.br', nome: 'Saiu', ativo: false },
    ],
  );
  assert.deepEqual(ps.map((p) => [p.email, p.ativos.length, p.cadastrado]), [
    ['ex@phd.com.br', 1, false],
    ['fulano@phd.com.br', 1, true],
  ]);
});

test('termos: pendente primeiro, aceito com a data mais recente, sem equipamento fora', () => {
  const lista = listaTermos(
    [
      a({ responsavel: 'ana@phd.com.br', situacao_termo: 'Assinado', data_assinatura_termo: '2026-11-10' }),
      a({ responsavel: 'ana@phd.com.br', situacao_termo: 'Assinado', data_assinatura_termo: '2026-11-12' }),
      a({ responsavel: 'bia@phd.com.br', situacao_termo: 'Assinado' }),
      a({ responsavel: 'bia@phd.com.br', situacao_termo: 'Sem termo' }),
    ],
    [
      { email: 'ana@phd.com.br', nome: 'Ana' },
      { email: 'bia@phd.com.br', nome: 'Bia' },
      { email: 'caio@phd.com.br', nome: 'Caio' },
    ],
  );
  assert.deepEqual(lista.map((p) => [p.nome, p.situacao, p.aceitoEm, p.pendentes]), [
    ['Bia', 'pendente', null, 1],
    ['Ana', 'aceito', '2026-11-12', 0],
  ]);
});

test('CPF: máscara e dígito verificador', () => {
  assert.equal(formatarCpf('52998224725'), '529.982.247-25');
  assert.equal(cpfValido('529.982.247-25'), true);
  assert.equal(cpfValido('529.982.247-24'), false);
  assert.equal(cpfValido('111.111.111-11'), false);
});

test('link da troca de equipamento leva série e tipo', async () => {
  const { linkTrocaEquipamento, ROTA_TROCA_EQUIPAMENTO } = await import('./regras.js');
  assert.equal(linkTrocaEquipamento(), ROTA_TROCA_EQUIPAMENTO);
  assert.equal(linkTrocaEquipamento({ numero_serie: 'PE 07', tipo: 'Notebook' }), `${ROTA_TROCA_EQUIPAMENTO}?numero_serie=PE+07&tipo=Notebook`);
});
