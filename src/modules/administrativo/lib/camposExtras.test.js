import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chaveDoRotulo, chaveUnica, validarCamposExtras, limparValores, mesclarComExtras,
} from './camposExtras.js';
import { schemaDoServico } from '../app/novo/formularios/schemas.js';

const campo = (over = {}) => ({
  chave: 'nome_do_cliente', rotulo: 'Nome do cliente', tipo: 'texto', obrigatorio: false, opcoes: [], ...over,
});

test('chaveDoRotulo: tira acento, caixa e pontuação', () => {
  assert.equal(chaveDoRotulo('Data prevista para INÍCIO no cliente'), 'data_prevista_para_inicio_no_cliente');
  assert.equal(chaveDoRotulo('Local da Obra (Estado/Cidade)'), 'local_da_obra_estado_cidade');
});

test('chaveUnica: dois rótulos iguais não se sobrescrevem', () => {
  assert.equal(chaveUnica('Observação', []), 'observacao');
  assert.equal(chaveUnica('Observação', ['observacao']), 'observacao_2');
  assert.equal(chaveUnica('Observação', ['observacao', 'observacao_2']), 'observacao_3');
});

test('chaveUnica: rótulo só com símbolos ainda gera chave utilizável', () => {
  assert.equal(chaveUnica('***', []), 'campo');
});

// O preenchimento é opcional por padrão — só o que foi marcado é exigido.
test('validarCamposExtras: campo opcional vazio passa', () => {
  assert.equal(validarCamposExtras([campo()], {}), '');
});

test('validarCamposExtras: campo obrigatório vazio é barrado', () => {
  const erro = validarCamposExtras([campo({ obrigatorio: true })], { nome_do_cliente: '   ' });
  assert.match(erro, /Nome do cliente/);
});

test('validarCamposExtras: número precisa ser número', () => {
  const def = [campo({ chave: 'qtd', rotulo: 'Quantidade', tipo: 'numero' })];
  assert.match(validarCamposExtras(def, { qtd: 'abc' }), /Quantidade/);
  assert.equal(validarCamposExtras(def, { qtd: '12' }), '');
});

test('limparValores: descarta vazios e converte número', () => {
  const def = [
    campo(),
    campo({ chave: 'qtd', rotulo: 'Quantidade', tipo: 'numero' }),
    campo({ chave: 'obs', rotulo: 'Obs' }),
  ];
  const saida = limparValores(def, { nome_do_cliente: 'Vale', qtd: '7', obs: '  ' });
  assert.deepEqual(saida, { nome_do_cliente: 'Vale', qtd: 7 });
});

// Valor de campo removido do cadastro não deve viajar junto no jsonb.
test('limparValores: ignora valor sem definição correspondente', () => {
  assert.deepEqual(limparValores([campo()], { nome_do_cliente: 'Vale', fantasma: 'x' }), { nome_do_cliente: 'Vale' });
});

// ---- convivência entre o formulário do serviço e os campos extras ----

const DEF = [
  { chave: 'centro_custo', rotulo: 'Centro de custo', tipo: 'texto' },
  { chave: 'quantidade', rotulo: 'Quantidade', tipo: 'numero' },
];

// O bug que isto tranca: usar limparValores sozinho devolvia só as chaves da
// definição e apagava tudo que o formulário do serviço tinha preenchido.
test('os campos do serviço sobrevivem à mesclagem', () => {
  const r = mesclarComExtras(
    { valor_base: 1200, fornecedor: 'ACME', centro_custo: 'CC-10' }, DEF,
  );
  assert.equal(r.valor_base, 1200);
  assert.equal(r.fornecedor, 'ACME');
  assert.equal(r.centro_custo, 'CC-10');
});

test('campo extra numérico chega como número, não como texto', () => {
  assert.equal(mesclarComExtras({ quantidade: '7' }, DEF).quantidade, 7);
});

// Espalhar por cima deixaria a chave vazia viver como '' dentro do jsonb.
test('campo extra em branco não é gravado', () => {
  const r = mesclarComExtras({ valor_base: 10, centro_custo: '   ' }, DEF);
  assert.ok(!('centro_custo' in r), 'chave vazia foi gravada');
  assert.equal(r.valor_base, 10);
});

test('sem campos extras cadastrados, nada do serviço se perde', () => {
  assert.deepEqual(mesclarComExtras({ a: 1, b: 'x' }, []), { a: 1, b: 'x' });
});

// Um campo extra "Valor base" geraria a chave `valor_base`, a mesma do campo de
// Compras — e sobrescreveria o valor do serviço dentro do mesmo jsonb.
test('campo extra não rouba a chave de um campo do serviço', () => {
  const doServico = schemaDoServico('compra', 'solicitacao-compra').map((c) => c.chave);
  assert.ok(doServico.includes('valor_base'));
  assert.equal(chaveUnica('Valor base', doServico), 'valor_base_2');
});
