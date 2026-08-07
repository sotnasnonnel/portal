import test from 'node:test';
import assert from 'node:assert/strict';
import { chaveDoRotulo, chaveUnica, validarCamposExtras, limparValores } from './camposExtras.js';

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
