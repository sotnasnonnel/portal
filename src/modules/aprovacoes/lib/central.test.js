import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ordenarPendencias, agruparPorFonte, erroDaDecisao, minhaVezNaAusencia,
  minhaVezNoReembolso, prestacaoEsperandoGestor, motivoParaAbrirReembolso, minhaVezNoAdicional,
} from './central.js';

test('adicional: nunca quem registrou nem o beneficiado; RH só o sem aprovador', () => {
  const r = { status: 'pendente', aprovador_id: 'chefe', registrado_por: 'g', colaborador_id: 'c' };
  assert.equal(minhaVezNoAdicional(r, 'chefe'), true);
  assert.equal(minhaVezNoAdicional(r, 'rh', true), false);
  assert.equal(minhaVezNoAdicional({ ...r, aprovador_id: null }, 'rh', true), true);
  assert.equal(minhaVezNoAdicional({ ...r, aprovador_id: 'g' }, 'g'), false);
});

test('o mais antigo vem primeiro', () => {
  const r = ordenarPendencias([{ quando: '2026-09-29' }, { quando: '2026-09-01' }, { quando: '2026-09-15' }]);
  assert.deepEqual(r.map((i) => i.quando), ['2026-09-01', '2026-09-15', '2026-09-29']);
});

test('agrupa na ordem das fontes e some com grupo vazio', () => {
  const g = agruparPorFonte([
    { fonte: 'reembolso', quando: '2' }, { fonte: 'dp', quando: '1' }, { fonte: 'reembolso', quando: '1' },
  ]);
  assert.deepEqual(g.map((x) => x.chave), ['dp', 'reembolso']);
  assert.deepEqual(g[1].itens.map((i) => i.quando), ['1', '2']);
});

test('reprovar exige motivo; aprovar não', () => {
  assert.equal(erroDaDecisao({ aprovar: false, comentario: '  ' }), 'Informe o motivo da reprovação.');
  assert.equal(erroDaDecisao({ aprovar: false, comentario: 'fora do prazo' }), '');
  assert.equal(erroDaDecisao({ aprovar: true }), '');
});

test('ausência: minha vez só no meu nome, ou sem aprovador quando sou RH', () => {
  const base = { status: 'pendente', colaborador_id: 'c1' };
  assert.equal(minhaVezNaAusencia({ ...base, aprovador_id: 'eu' }, 'eu'), true);
  assert.equal(minhaVezNaAusencia({ ...base, aprovador_id: 'outro' }, 'eu', true), false, 'RH não recebe o do gestor');
  assert.equal(minhaVezNaAusencia({ ...base, aprovador_id: null }, 'eu', true), true);
  assert.equal(minhaVezNaAusencia({ ...base, aprovador_id: null }, 'eu', false), false);
  assert.equal(minhaVezNaAusencia({ ...base, colaborador_id: 'eu', aprovador_id: 'eu' }, 'eu'), false, 'nunca o próprio');
  assert.equal(minhaVezNaAusencia({ ...base, status: 'aprovada', aprovador_id: 'eu' }, 'eu'), false);
});

test('reembolso: só o gestor atribuído, e nunca o próprio pedido', () => {
  const gestor = { id: 'g', role: 'gestor' };
  const r = { status: 'em_analise', manager_id: 'g', requester_id: 's' };
  assert.equal(minhaVezNoReembolso(r, gestor), true);
  assert.equal(minhaVezNoReembolso({ ...r, requester_id: 'g' }, gestor), false);
  assert.equal(minhaVezNoReembolso(r, { id: 'g', role: 'solicitante' }), false);
  assert.equal(minhaVezNoReembolso({ ...r, status: 'aprovado' }, gestor), false);
});

test('prestação de contas em análise espera o gestor do adiantamento', () => {
  const gestor = { id: 'g', role: 'gestor' };
  assert.equal(prestacaoEsperandoGestor({ kind: 'adiantamento', manager_id: 'g', accountability_status: 'em_analise' }, gestor), true);
  assert.equal(prestacaoEsperandoGestor({ kind: 'adiantamento', manager_id: 'g', accountability_status: 'pendente' }, gestor), false);
  assert.equal(prestacaoEsperandoGestor({ kind: 'reembolso', manager_id: 'g', accountability_status: 'em_analise' }, gestor), false);
});

test('adiantamento e reembolso sem problema aprovam direto', () => {
  assert.equal(motivoParaAbrirReembolso({ kind: 'adiantamento' }, []), '');
  assert.equal(motivoParaAbrirReembolso({ kind: 'reembolso' }, [{ description: 'UBER', value: 30, qty: 1 }]), '');
});

test('item fora da política manda para o pedido', () => {
  const m = motivoParaAbrirReembolso({ kind: 'reembolso' }, [{ description: 'CERVEJA', value: 20, qty: 1 }]);
  assert.match(m, /fora da política|excedente/);
});
