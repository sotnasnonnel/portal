import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validarRegistro, antecedenciaDias, antecedenciaMedia, rotuloPassagem,
} from './folgaCampo.js';

const HOJE = '2026-09-30';
const base = { inicio: '2026-10-05', fim: '2026-10-07', motivo: 'Visita à família', hoje: HOJE };

test('a pergunta da passagem é obrigatória', () => {
  const r = validarRegistro(base);
  assert.equal(r.ok, false);
  assert.ok(r.erros.includes('Responda se você já possui passagem comprada.'));
  assert.equal(validarRegistro({ ...base, passagem: false }).ok, true, '"não" é resposta válida');
  assert.equal(validarRegistro({ ...base, passagem: true }).ok, true);
});

test('antecedência = data da folga − dia do pedido, em dias corridos', () => {
  assert.equal(antecedenciaDias({ data_inicio: '2026-10-05', enviado_em: '2026-09-30T14:00:00' }), 5);
  assert.equal(antecedenciaDias({ data_inicio: '2026-09-30', enviado_em: '2026-09-30T08:00:00' }), 0);
  assert.equal(antecedenciaDias({ data_inicio: '2026-10-05' }), null);
});

test('média da antecedência ignora canceladas e arredonda para baixo', () => {
  const m = antecedenciaMedia([
    { status: 'aprovada', data_inicio: '2026-10-05', enviado_em: '2026-09-30T10:00:00' }, // 5
    { status: 'pendente', data_inicio: '2026-10-02', enviado_em: '2026-09-30T10:00:00' }, // 2
    { status: 'cancelada', data_inicio: '2026-12-30', enviado_em: '2026-09-30T10:00:00' }, // fora
  ]);
  assert.deepEqual(m, { media: 3, total: 2 });
  assert.deepEqual(antecedenciaMedia([]), { media: null, total: 0 });
});

test('resposta da passagem: registro antigo não tem resposta', () => {
  assert.equal(rotuloPassagem({ passagem_comprada: true }), 'Sim');
  assert.equal(rotuloPassagem({ passagem_comprada: false }), 'Não');
  assert.equal(rotuloPassagem({ passagem_comprada: null }), '—');
});
