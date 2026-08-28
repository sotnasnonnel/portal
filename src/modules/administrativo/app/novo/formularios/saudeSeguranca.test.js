import test from 'node:test';
import assert from 'node:assert/strict';
import { MOTIVOS, inicialSaudeSeguranca, validarSaudeSeguranca } from './saudeSeguranca.js';

const base = () => ({ ...inicialSaudeSeguranca(), cc: 'CC-100' });

// Os dois modos, explícitos: o teste não depende do valor atual de
// ESTOQUE_VITRINE, e a troca do flag não quebra a suíte.
const LIGADO = { vitrine: false };
const VITRINE = { vitrine: true };

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
    assert.match(validarSaudeSeguranca(inicialSaudeSeguranca(), s, LIGADO), /centro de custo/i);
  }
});

test('EPI exige item do catálogo e motivo', () => {
  assert.match(validarSaudeSeguranca(base(), 'epi', LIGADO), /EPI/i);
  assert.match(validarSaudeSeguranca({ ...base(), itens: [item()] }, 'epi', LIGADO), /motivo/i);
  assert.equal(validarSaudeSeguranca({ ...base(), itens: [item()], motivo: MOTIVOS[0] }, 'epi', LIGADO), '');
});

test('uniforme exige peça do catálogo e motivo', () => {
  assert.match(validarSaudeSeguranca(base(), 'uniforme', LIGADO), /peça/i);
  assert.match(validarSaudeSeguranca({ ...base(), itens: [item()] }, 'uniforme', LIGADO), /motivo/i);
  assert.equal(validarSaudeSeguranca({ ...base(), itens: [item()], motivo: MOTIVOS[1] }, 'uniforme', LIGADO), '');
});

// A quantidade é o que o estoque vai descontar na baixa: sem ela válida, a
// entrega não fecha.
test('quantidade precisa ser inteira e maior que zero', () => {
  const com = (q) => validarSaudeSeguranca(
    { ...base(), itens: [item({ quantidade: q })], motivo: MOTIVOS[0] }, 'epi', LIGADO,
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
      { ...base(), itens: [item({ variante_id: '' })], motivo: MOTIVOS[0] }, 'epi', LIGADO,
    ),
    /quantidade inteira maior que zero/,
  );
});

test('outras demandas pede só o CC — o resto é a descrição do chamado', () => {
  assert.equal(validarSaudeSeguranca(base(), 'outras', LIGADO), '');
});

// Os campos antigos continuam existindo no estado (chamados legados e os filhos
// da mobilização usam esse formato), mas não valem mais como pedido preenchido.
test('os campos legados não substituem a escolha de itens', () => {
  assert.match(validarSaudeSeguranca({ ...base(), tipo: ['Capacete'] }, 'epi', LIGADO), /EPI/i);
  assert.match(validarSaudeSeguranca({ ...base(), tipo_livre: '2 polos M' }, 'uniforme', LIGADO), /peça/i);
});

// Enquanto o catálogo do Estoque não está no ar, o pedido volta ao formato
// antigo. Sem isto, com o catálogo vazio, ninguém abriria esses chamados.
test('modo vitrine: volta a exigir os campos antigos, e não os itens', () => {
  assert.match(validarSaudeSeguranca(base(), 'epi', VITRINE), /EPI/i);
  assert.equal(
    validarSaudeSeguranca({ ...base(), tipo: ['Capacete'], motivo: MOTIVOS[0] }, 'epi', VITRINE),
    '',
  );
  assert.match(validarSaudeSeguranca(base(), 'uniforme', VITRINE), /peças/i);
  assert.equal(
    validarSaudeSeguranca({ ...base(), tipo_livre: '2 polos M', motivo: MOTIVOS[1] }, 'uniforme', VITRINE),
    '',
  );
  // E o formato novo não é exigido: item escolhido sem os campos antigos não
  // basta em vitrine, porque o formulário nem oferece o seletor.
  assert.match(validarSaudeSeguranca({ ...base(), itens: [item()], motivo: MOTIVOS[0] }, 'epi', VITRINE), /EPI/i);
  // O CC continua obrigatório nos dois modos.
  assert.match(validarSaudeSeguranca(inicialSaudeSeguranca(), 'epi', VITRINE), /centro de custo/i);
});
