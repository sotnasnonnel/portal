import test from 'node:test';
import assert from 'node:assert/strict';
import { numero, codigoTexto, separarCaDoNome, normalizarPlanilha, planejarImportacao } from './importar.js';

// Fixtures com os cabeçalhos REAIS das duas planilhas de
// referencia/referencia_estoque/, inclusive as esquisitices: a linha "Data
// Atual" antes do cabeçalho dos EPIs, a coluna "EPI'S USADOS", as linhas em
// branco que só carregam a fórmula do saldo, a linha "TOTAL" do fim dos
// uniformes e a tabela dinâmica solta à direita.

const EPI = [
  ['Data Atual', '', '', '', '', '', '', ''],
  ['DESCRIÇÃO', 'TAMANHO', 'CA', "EPI'S USADOS ", 'ESTOQUE ENTRADA ', 'ESTOQUE ATUAL', 'ESTOQUE MINIMO', 'ESTOQUE MÁXIMO'],
  ['CAPACETE 3M', '', '29638', '', '5', '5', '', ''],
  ['CAPACETE MSA', '', '8304', '12', '2', '14', '', ''],
  ['RESPIRADOR COM VÁLVULA ', '', '45021', '', '2', '2', '', ''],
  ['RESPIRADOR COM VÁLVULA ', '', '12011', '', '2', '2', '', ''],
  ['BOTINA COM METATARSO ', '39', '48582', '', '3', '3', '2', ''],
  ['ÓCULOS DE PROTEÇÃO ESCURO ', '-', '', '', '2', '2', '', ''],
  ['', '', '', '', '', '0', '', ''],
  ['', '', '', '', '', '0', '', ''],
];

const UNIFORME = [
  ['CONTROLE DE UNIFORMES'],
  ['CÓDIGO', 'SETOR', 'DESCRIÇÃO', 'GÊNERO', 'TAMANHO', 'ESTOQUE', 'ESTOQUE MINIMO', 'ESTOQUE MÁXIMO', 'STATUS', 'A SOLICITAR', 'TOTAL DE KITS', 'VALOR UNITÁRIO', 'TOTAL'],
  ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Setor', 'Quantidade'],
  ['1', 'Sede', 'Camisa Polo', 'Masculino', 'P', '1', '', '', '', '', '', '50,70', '0'],
  ['4', 'Sede', 'Camisa Polo', 'Masculino', 'GG', '28', '', '', '', '', '', '50,70', '0'],
  ['36', 'Sede ', 'Agasalho', 'Unisex', 'P', '5', '', '', '', '', '', '', ''],
  ['', 'Sede ', 'Camisa social Branca ', 'Masculino ', 'M', '2'],
  ['TOTAL', '', '', '', '', '', '', '', ''],
];

test('numero aceita ponto e vírgula decimal, e distingue vazio de zero', () => {
  assert.equal(numero('50.7'), 50.7);
  assert.equal(numero('50,70'), 50.7);
  assert.equal(numero('1.234,56'), 1234.56);
  assert.equal(numero('0'), 0);
  assert.equal(numero(''), null);
  assert.equal(numero('   '), null);
  assert.equal(numero('abc'), null);
});

test('numero aceita célula numérica crua (o caminho normal com raw:true)', () => {
  assert.equal(numero(50.7), 50.7);
  assert.equal(numero(0), 0);
  assert.equal(numero(NaN), null);
});

// O bug que só apareceu ao rodar contra o arquivo real: com raw:false o SheetJS
// devolve o CA 45021 como "45,021", e o CA faz parte da chave da variante.
test('codigoTexto não deixa CA virar número com separador de milhar', () => {
  assert.equal(codigoTexto(45021), '45021');
  assert.equal(codigoTexto('45,021'), '45021');
  assert.equal(codigoTexto('45.021'), '45021');
  assert.equal(codigoTexto(42), '42');
  assert.equal(codigoTexto('P'), 'P');
  assert.equal(codigoTexto(''), '');
  assert.equal(codigoTexto(undefined), '');
  // Não é agrupamento de milhar: não mexe.
  assert.equal(codigoTexto('1,5'), '1,5');
});

test('EPI cru: CA numérico vira texto limpo e entra na chave', () => {
  const m = [
    ['DESCRIÇÃO', 'TAMANHO', 'CA', 'ESTOQUE ATUAL'],
    ['RESPIRADOR COM VÁLVULA', '', 45021, 2],
    ['RESPIRADOR COM VÁLVULA', '', 12011, 2],
    ['BOTINA COM METATARSO', 39, 48582, 3],
  ];
  const { linhas } = normalizarPlanilha(m, 'epi');
  assert.deepEqual(linhas.map((l) => l.ca), ['45021', '12011', '48582']);
  assert.equal(linhas[2].tamanho, '39');
  assert.notEqual(linhas[0].chave, linhas[1].chave);
});

test('separarCaDoNome só extrai quando a coluna CA está vazia', () => {
  assert.deepEqual(separarCaDoNome('ABAFADOR DE CONCHA 3M (33835)', ''),
    { descricao: 'ABAFADOR DE CONCHA 3M', ca: '33835' });
  assert.deepEqual(separarCaDoNome('ABAFADOR (CA 33835)', ''),
    { descricao: 'ABAFADOR', ca: '33835' });
  // Coluna preenchida manda: o nome fica intacto.
  assert.deepEqual(separarCaDoNome('ABAFADOR DE CONCHA 3M (33835)', '99999'),
    { descricao: 'ABAFADOR DE CONCHA 3M (33835)', ca: '99999' });
  assert.deepEqual(separarCaDoNome('CAPACETE 3M', ''), { descricao: 'CAPACETE 3M', ca: '' });
});

test('EPI: acha o cabeçalho na 2ª linha e ignora as linhas sem descrição', () => {
  const { linhas, ignoradas, avisos } = normalizarPlanilha(EPI, 'epi');
  assert.equal(linhas.length, 6);
  assert.equal(ignoradas, 2);
  assert.deepEqual(avisos, []);
});

test('EPI: lê ESTOQUE ATUAL como saldo (o valor da fórmula, não a soma das entradas)', () => {
  const { linhas } = normalizarPlanilha(EPI, 'epi');
  const msa = linhas.find((l) => l.descricao === 'CAPACETE MSA');
  assert.equal(msa.saldo, 14);   // usados 12 + entrada 2
  assert.equal(msa.ca, '8304');
});

// A razão de o CA estar na chave: sem ele estas duas linhas viram uma só.
test('EPI: RESPIRADOR COM VÁLVULA com 2 CAs gera 2 variantes distintas', () => {
  const { linhas } = normalizarPlanilha(EPI, 'epi');
  const resp = linhas.filter((l) => l.descricao.startsWith('RESPIRADOR'));
  assert.equal(resp.length, 2);
  assert.notEqual(resp[0].chave, resp[1].chave);
  assert.deepEqual(resp.map((r) => r.ca).sort(), ['12011', '45021']);
});

test('EPI: tamanho "-" vira vazio e mínimo em branco vira 0', () => {
  const { linhas } = normalizarPlanilha(EPI, 'epi');
  assert.equal(linhas.find((l) => l.descricao.startsWith('ÓCULOS')).tamanho, '');
  assert.equal(linhas.find((l) => l.descricao === 'CAPACETE 3M').estoque_minimo, 0);
  assert.equal(linhas.find((l) => l.descricao.startsWith('BOTINA')).estoque_minimo, 2);
  // Máximo em branco fica null, não 0 — 0 classificaria tudo como excesso.
  assert.equal(linhas.find((l) => l.descricao === 'CAPACETE 3M').estoque_maximo, null);
});

test('UNIFORME: normaliza gênero/setor, lê valor unitário em pt-BR e descarta a linha TOTAL', () => {
  const { linhas, ignoradas, avisos } = normalizarPlanilha(UNIFORME, 'uniforme');
  assert.equal(linhas.length, 4);
  assert.equal(ignoradas, 2);   // a linha vazia da tabela dinâmica e a linha TOTAL
  assert.deepEqual(avisos, []);

  const polo = linhas[0];
  assert.equal(polo.genero, 'masculino');
  assert.equal(polo.setor, 'sede');
  assert.equal(polo.custo_unitario, 50.7);
  assert.equal(polo.codigo, '1');

  assert.equal(linhas.find((l) => l.descricao === 'Agasalho').genero, 'unisex');
  // "Sede " com espaço e "Masculino " também precisam casar.
  assert.equal(linhas.find((l) => l.descricao.startsWith('Camisa social')).setor, 'sede');
  assert.equal(linhas.find((l) => l.descricao.startsWith('Camisa social')).genero, 'masculino');
});

test('avisa quando a aba escolhida não tem tabela de estoque', () => {
  const r = normalizarPlanilha([['Entrega dos agasalhos'], ['', '', 'Entregue', '23']], 'epi');
  assert.equal(r.linhas.length, 0);
  assert.match(r.avisos[0], /cabeçalho/);
});

test('avisa em saldo não numérico e em negativo, importando como 0', () => {
  const m = [
    ['DESCRIÇÃO', 'TAMANHO', 'CA', 'ESTOQUE ATUAL'],
    ['CAPACETE', '', '', '#REF!'],
    ['LUVA', '', '', '-3'],
  ];
  const { linhas, avisos } = normalizarPlanilha(m, 'epi');
  assert.equal(linhas[0].saldo, 0);
  assert.equal(linhas[1].saldo, 0);
  assert.equal(avisos.length, 2);
  assert.match(avisos[0], /não é um número/);
  assert.match(avisos[1], /negativo/);
});

test('avisa duplicata dentro do próprio arquivo', () => {
  const m = [
    ['DESCRIÇÃO', 'TAMANHO', 'CA', 'ESTOQUE ATUAL'],
    ['CAPACETE 3M', '', '29638', '5'],
    ['CAPACETE 3M', '', '29638', '9'],
  ];
  const { avisos } = normalizarPlanilha(m, 'epi');
  assert.match(avisos[0], /repete a linha 2/);
});

test('gênero e setor desconhecidos viram branco com aviso, sem derrubar a linha', () => {
  const m = [
    ['SETOR', 'DESCRIÇÃO', 'GÊNERO', 'TAMANHO', 'ESTOQUE'],
    ['Almoxarifado', 'Camisa Polo', 'Neutro', 'M', '3'],
  ];
  const { linhas, avisos } = normalizarPlanilha(m, 'uniforme');
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].genero, '');
  assert.equal(linhas[0].setor, '');
  assert.equal(avisos.length, 2);
});

test('planejarImportacao: primeira carga cria tudo', () => {
  const { linhas } = normalizarPlanilha(EPI, 'epi');
  const plano = planejarImportacao(linhas, []);
  assert.equal(plano.resumo.criar, 6);
  assert.equal(plano.resumo.atualizar, 0);
  assert.equal(plano.resumo.pecas, 5 + 14 + 2 + 2 + 3 + 2);
});

// Idempotência: reimportar o mesmo arquivo não pode dobrar o saldo.
test('planejarImportacao: reimportar o mesmo arquivo não muda nada', () => {
  const { linhas } = normalizarPlanilha(EPI, 'epi');
  const posicao = linhas.map((l, i) => ({
    id: `v${i}`, categoria: l.categoria, descricao: l.descricao, tamanho: l.tamanho,
    ca: l.ca, genero: l.genero, setor: l.setor,
    saldo: l.saldo, estoque_minimo: l.estoque_minimo, estoque_maximo: l.estoque_maximo,
    custo_unitario: l.custo_unitario,
  }));
  const plano = planejarImportacao(linhas, posicao);
  assert.equal(plano.resumo.criar, 0);
  assert.equal(plano.resumo.atualizar, 0);
  assert.equal(plano.resumo.semMudanca, 6);
});

test('planejarImportacao: saldo diferente vira ajuste com o delta, não nova entrada', () => {
  const { linhas } = normalizarPlanilha(EPI, 'epi');
  const posicao = [{
    id: 'v1', categoria: 'epi', descricao: 'CAPACETE 3M', tamanho: '', ca: '29638',
    genero: '', setor: '', saldo: 2, estoque_minimo: 0, estoque_maximo: null, custo_unitario: null,
  }];
  const plano = planejarImportacao(linhas, posicao);
  assert.equal(plano.resumo.criar, 5);
  assert.equal(plano.resumo.atualizar, 1);
  assert.equal(plano.atualizar[0].delta, 3);   // planilha 5 - sistema 2
  assert.equal(plano.atualizar[0].variante_id, 'v1');
});

test('planejarImportacao: mudança só de mínimo/custo entra como atualização sem ajuste', () => {
  const linhas = normalizarPlanilha(UNIFORME, 'uniforme').linhas;
  const polo = linhas[0];
  const posicao = [{
    id: 'u1', categoria: 'uniforme', descricao: 'Camisa Polo', tamanho: 'P',
    ca: '', genero: 'masculino', setor: 'sede',
    saldo: polo.saldo, estoque_minimo: 4, estoque_maximo: null, custo_unitario: 50.7,
  }];
  const plano = planejarImportacao(linhas, posicao);
  assert.equal(plano.resumo.atualizar, 1);
  assert.equal(plano.resumo.ajustes, 0);
  assert.equal(plano.atualizar[0].delta, 0);
  assert.equal(plano.atualizar[0].mudouCadastro, true);
});
