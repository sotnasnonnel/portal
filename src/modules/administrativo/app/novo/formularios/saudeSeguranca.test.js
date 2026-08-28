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

test('EPI exige item do catálogo e motivo', () => {
  assert.match(validarSaudeSeguranca(base(), 'epi'), /EPI/i);
  assert.match(validarSaudeSeguranca({ ...base(), itens: [item()] }, 'epi'), /motivo/i);
  assert.equal(validarSaudeSeguranca({ ...base(), itens: [item()], motivo: MOTIVOS[0] }, 'epi'), '');
});

test('uniforme exige peça do catálogo e motivo', () => {
  assert.match(validarSaudeSeguranca(base(), 'uniforme'), /peça/i);
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

// Os campos antigos continuam existindo no estado (chamados legados e os filhos
// da mobilização usam esse formato), mas não valem mais como pedido preenchido.
test('os campos legados não substituem a escolha de itens', () => {
  assert.match(validarSaudeSeguranca({ ...base(), tipo: ['Capacete'] }, 'epi'), /EPI/i);
  assert.match(validarSaudeSeguranca({ ...base(), tipo_livre: '2 polos M' }, 'uniforme'), /peça/i);
});
