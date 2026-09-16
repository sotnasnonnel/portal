import test from 'node:test';
import assert from 'node:assert/strict';
import { indexar, loteCalculo, loteInput, atualizacaoCadastral, prestadorDaLinha } from './lote.js';

const CONFIG = { base_proporcional: '30_dias', proporcional_admissao: true, proporcional_encerramento: true, bloquear_termo_divergencia: true, tolerancia_bruto: 0.01 };
const AGO = '2026-08-01';
const P = { id: 'p1', nome: 'FULANO', valor_mensal: 9000, data_inicio: '2024-01-01', beneficios: { medico: { ativo: true } } };
const ENV = {
  id: 'e1', prestador_id: 'p1', bruto: 9000, descontos: 0, termo: 'disponivel', envio: 'nao_enviado', resolucoes: [],
  eventos: [{ codigo: '1000', descricao: 'VALOR BRUTO CONTRATUAL', natureza: 'provento', valor: '9000.00', referencia: '30' }],
};
const linha = (over = {}) => ({
  linha: 3, nome: 'Fulano', bruto: 9000, descontos_total: 350, soma_colunas: 350, liquido: 8650,
  descontos: { plano_saude: 300, copart_titular: 50 }, ...over,
});

test('loteCalculo: pendentes pula quem já foi calculado', () => {
  const indice = indexar({ prestadores: [P] });
  const envs = [ENV, { ...ENV, id: 'e2', calculado_em: '2026-08-02' }];
  const r = loteCalculo({ envelopes: envs, indice, config: CONFIG, competencia: AGO, centros: {}, origem: 'x', pendentes: true });
  assert.equal(r.length, 1);
  assert.equal(r[0].calculo.origem, 'x');
});

test('input só de descontos preserva o valor contratual', () => {
  const indice = indexar({ prestadores: [P] });
  const [payload] = loteInput({
    casados: [{ linha: linha({ bruto: 9999 }), prestador: P }], envelopes: [ENV], indice, config: CONFIG, competencia: AGO, centros: {}, modo: 'descontos', arquivo: 'LIQ.xlsx',
  });
  assert.equal(payload.bruto, 9000);
  assert.equal(payload.descontos, 350);
  assert.deepEqual(payload.eventos.map((e) => e.codigo), ['1000', '2001', '2002']);
  // bruto da planilha diferente do contrato vira divergência para o DP decidir
  assert.equal(payload.conferencia, 'divergente');
  assert.equal(payload.divergencias[0].tipo, 'bruto_planilha');
  assert.equal(payload.termo, 'bloqueado');
});

test('input completo usa o bruto da planilha e confere', () => {
  const indice = indexar({ prestadores: [{ ...P, valor_mensal: 9500 }] });
  const [payload] = loteInput({
    casados: [{ linha: linha({ bruto: 9500 }), prestador: { ...P, valor_mensal: 9500 } }], envelopes: [ENV], indice, config: CONFIG, competencia: AGO, centros: {}, modo: 'completo', arquivo: 'LIQ.xlsx',
  });
  assert.equal(payload.bruto, 9500);
  assert.equal(payload.conferencia, 'ok');
  assert.equal(payload.planilha.descontos_total, 350);
});

test('atualização cadastral só com o que a planilha traz', () => {
  const patch = atualizacaoCadastral({ ...P, razao_social: 'X LTDA', email: 'a@b' }, { razao_social: 'nova ltda', email: '', bruto: 9000, cnpj: '11.222.333/0001-81' });
  assert.deepEqual(patch, { razao_social: 'NOVA LTDA', cnpj: '11.222.333/0001-81' });
});

test('prestador novo da linha', () => {
  const p = prestadorDaLinha(linha({ empresa: 'PHD Engenharia', cnpj: '123' }), { competencia: AGO, empresaPadrao: 'PHD ASSESSORIA' });
  assert.equal(p.empresa, 'PHD ENGENHARIA');
  assert.equal(p.cnpj, null);
  assert.equal(p.data_inicio, AGO);
  assert.equal(p.cadastro_origem, 'planilha');
});
