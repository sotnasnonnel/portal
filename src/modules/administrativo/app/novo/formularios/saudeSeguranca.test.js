import test from 'node:test';
import assert from 'node:assert/strict';
import { MOTIVOS, inicialSaudeSeguranca, validarSaudeSeguranca } from './saudeSeguranca.js';

const base = () => ({ ...inicialSaudeSeguranca(), cc: 'CC-100' });

test('motivo cobre item novo e as duas substituições da planilha', () => {
  assert.deepEqual(MOTIVOS, ['Item novo', 'Substituição por quebra', 'Substituição por desgaste']);
});

test('CC é exigido nos três serviços', () => {
  for (const s of ['epi', 'uniforme', 'outras']) {
    assert.match(validarSaudeSeguranca(inicialSaudeSeguranca(), s), /centro de custo/i);
  }
});

test('EPI exige item escolhido e motivo', () => {
  assert.match(validarSaudeSeguranca(base(), 'epi'), /EPI/i);
  assert.match(validarSaudeSeguranca({ ...base(), tipo: ['Capacete'] }, 'epi'), /motivo/i);
  assert.equal(validarSaudeSeguranca({ ...base(), tipo: ['Capacete'], motivo: MOTIVOS[0] }, 'epi'), '');
});

// Uniforme não tem lista no portal: o "tipo" dele é texto, não seleção.
test('uniforme exige a descrição das peças e o motivo', () => {
  assert.match(validarSaudeSeguranca(base(), 'uniforme'), /peças/i);
  assert.match(validarSaudeSeguranca({ ...base(), tipo_livre: '2 polos M' }, 'uniforme'), /motivo/i);
  assert.equal(validarSaudeSeguranca({ ...base(), tipo_livre: '2 polos M', motivo: MOTIVOS[1] }, 'uniforme'), '');
});

test('outras demandas pede só o CC — o resto é a descrição do chamado', () => {
  assert.equal(validarSaudeSeguranca(base(), 'outras'), '');
});

// Marcar o EPI escolhido não pode valer como uniforme preenchido, e vice-versa.
test('os campos de tipo não se substituem entre os serviços', () => {
  assert.match(validarSaudeSeguranca({ ...base(), tipo_livre: '2 polos M' }, 'epi'), /EPI/i);
  assert.match(validarSaudeSeguranca({ ...base(), tipo: ['Capacete'] }, 'uniforme'), /peças/i);
});
