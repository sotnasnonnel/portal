import test from 'node:test';
import assert from 'node:assert/strict';
import { MOTIVOS, inicialSaudeSeguranca, validarSaudeSeguranca } from './saudeSeguranca.js';

const base = () => ({ ...inicialSaudeSeguranca(), cc: 'CC-100' });


// Item já escolhido do catálogo do Estoque, no formato que vai para
// chamados_adm.campos.itens.
const item = (p) => ({
  variante_id: 'v1', descricao: 'CAPACETE 3M', tamanho: '', ca: '29638',
  genero: '', setor: '', quantidade: 1, ...p,
});

test('motivo cobre item novo e as duas substituições da planilha', () => {
  assert.deepEqual(MOTIVOS, ['Item novo', 'Substituição por quebra', 'Substituição por desgaste']);
});

test('CC é exigido nos três serviços', () => {
  for (const s of ['epi', 'uniforme', 'outras']) {
    assert.match(validarSaudeSeguranca(inicialSaudeSeguranca(), s), /centro de custo/i);
  }
});

test('EPI: pedido vazio é recusado, com item do catálogo passa', () => {
  assert.match(validarSaudeSeguranca(base(), 'epi'), /catálogo ou descreva/i);
  assert.match(validarSaudeSeguranca({ ...base(), itens: [item()] }, 'epi'), /motivo/i);
  assert.equal(validarSaudeSeguranca({ ...base(), itens: [item()], motivo: MOTIVOS[0] }, 'epi'), '');
});

test('uniforme: pedido vazio é recusado, com item do catálogo passa', () => {
  assert.match(validarSaudeSeguranca(base(), 'uniforme'), /catálogo ou descreva/i);
  assert.match(validarSaudeSeguranca({ ...base(), itens: [item()] }, 'uniforme'), /motivo/i);
  assert.equal(validarSaudeSeguranca({ ...base(), itens: [item()], motivo: MOTIVOS[1] }, 'uniforme'), '');
});

// A quantidade é o que o estoque vai descontar na baixa: sem ela válida, a
// entrega não fecha.
test('quantidade precisa ser inteira e maior que zero', () => {
  const com = (q) => validarSaudeSeguranca(
    { ...base(), itens: [item({ quantidade: q })], motivo: MOTIVOS[0] }, 'epi',
  );
  assert.match(com(0), /quantidade inteira maior que zero/);
  assert.match(com(-1), /quantidade inteira maior que zero/);
  assert.match(com(1.5), /quantidade inteira maior que zero/);
  assert.match(com(''), /quantidade inteira maior que zero/);
  // O input devolve texto; "2" tem de passar.
  assert.equal(com('2'), '');
  assert.equal(com(3), '');
});

test('item sem variante escolhida é recusado', () => {
  assert.match(
    validarSaudeSeguranca(
      { ...base(), itens: [item({ variante_id: '' })], motivo: MOTIVOS[0] }, 'epi',
    ),
    /quantidade inteira maior que zero/,
  );
});

test('outras demandas pede só o CC — o resto é a descrição do chamado', () => {
  assert.equal(validarSaudeSeguranca(base(), 'outras'), '');
});

// A REGRA CENTRAL: o estado do estoque nunca bloqueia um pedido. Catálogo
// vazio ou item não cadastrado são problema de quem fornece, não de quem
// precisa do EPI — e é o pedido que sinaliza a compra.
test('texto livre basta: catálogo vazio não impede abrir o chamado', () => {
  const soTexto = { ...base(), tipo_livre: '2 camisas polo M', motivo: MOTIVOS[0] };
  assert.equal(validarSaudeSeguranca(soTexto, 'epi'), '');
  assert.equal(validarSaudeSeguranca(soTexto, 'uniforme'), '');
});

test('catálogo e texto livre podem vir juntos', () => {
  const ambos = {
    ...base(), itens: [item()], tipo_livre: '1 luva anticorte 9', motivo: MOTIVOS[0],
  };
  assert.equal(validarSaudeSeguranca(ambos, 'epi'), '');
});

// O formato legado do desdobramento da mobilização (lib/desdobramento.js)
// precisa continuar valendo, senão a mobilização para de gerar os filhos.
test('o formato legado do desdobramento continua aceito', () => {
  assert.equal(
    validarSaudeSeguranca({ ...base(), tipo: ['Capacete'], motivo: MOTIVOS[0] }, 'epi'),
    '',
  );
});

// Espaço em branco não é pedido.
test('texto livre só com espaços não conta como pedido', () => {
  assert.match(
    validarSaudeSeguranca({ ...base(), tipo_livre: '   ', motivo: MOTIVOS[0] }, 'epi'),
    /catálogo ou descreva/i,
  );
});

