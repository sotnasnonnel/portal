import test from 'node:test';
import assert from 'node:assert/strict';
import { podeEditarRequisicao, podeResponderRequisicao, getReenvioConfig, REENVIO_CONFIG } from './reenvio.js';

const EU = '11111111-1111-1111-1111-111111111111';
const OUTRO = '22222222-2222-2222-2222-222222222222';
const sol = (over = {}) => ({ tipo: 'mapeamento', status: 'pendente', gestor_id: EU, ...over });

// ---- Editar (recomeça a cadeia): só o dono, só em andamento ----

test('podeEditar: solicitante edita a própria requisição em andamento', () => {
  assert.equal(podeEditarRequisicao(sol(), EU), true);
});

test('podeEditar: quem não é o solicitante nunca edita (nem o aprovador da vez)', () => {
  assert.equal(podeEditarRequisicao(sol(), OUTRO), false);
});

test('podeEditar: status terminal não é editável', () => {
  for (const status of ['concluida', 'reprovada', 'cancelada', 'devolvida']) {
    assert.equal(podeEditarRequisicao(sol({ status }), EU), false, `status ${status} deveria bloquear`);
  }
});

test('podeEditar: tipo sem editor configurado fica de fora', () => {
  assert.equal(podeEditarRequisicao(sol({ tipo: 'tipo_inexistente' }), EU), false);
});

test('podeEditar: sem usuário logado (id vazio) não libera nada', () => {
  assert.equal(podeEditarRequisicao(sol(), null), false);
  assert.equal(podeEditarRequisicao(sol({ gestor_id: null }), null), false);
});

test('podeEditar: id em caixa diferente ainda é o mesmo dono', () => {
  assert.equal(podeEditarRequisicao(sol({ gestor_id: EU.toUpperCase() }), EU), true);
});

// ---- Responder (volta a quem reprovou): inalterado, só na reprovada ----

test('podeResponder: só quando reprovada, e só para o dono', () => {
  assert.equal(podeResponderRequisicao(sol({ status: 'reprovada' }), EU), true);
  assert.equal(podeResponderRequisicao(sol({ status: 'reprovada' }), OUTRO), false);
  assert.equal(podeResponderRequisicao(sol({ status: 'pendente' }), EU), false);
});

test('editar e responder nunca aparecem juntos (caminhos excludentes)', () => {
  for (const status of ['pendente', 'reprovada', 'concluida', 'cancelada']) {
    const s = sol({ status });
    assert.equal(podeEditarRequisicao(s, EU) && podeResponderRequisicao(s, EU), false);
  }
});

// ---- Contrato com a edição: o que alimenta o recálculo da alçada ----

test('todo tipo editável tem editor e payload; nova_vaga mantém fora do quadro', () => {
  for (const tipo of Object.keys(REENVIO_CONFIG)) {
    const cfg = getReenvioConfig(tipo);
    assert.ok(cfg.campos?.length, `${tipo} sem campos`);
    assert.ok(cfg.modo === 'detalhe' ? cfg.montarPayload : cfg.montarPatch, `${tipo} sem montador de payload`);
  }
  // A Nova Vaga é aumento de quadro por definição (§5.1): ao editar, a cadeia
  // precisa ser recalculada com foraDoQuadro, senão o Diretor/Financeiro somem.
  assert.equal(getReenvioConfig('nova_vaga').foraDoQuadro, true);
});

test('funcaoAlvoDe lê a função do formulário EDITADO (é ela que muda a alçada)', () => {
  assert.equal(getReenvioConfig('nova_vaga').funcaoAlvoDe({ funcao: 'ENGENHEIRO' }), 'ENGENHEIRO');
  assert.equal(getReenvioConfig('aumento_salario').funcaoAlvoDe({ funcao_proposta: 'GERENTE' }), 'GERENTE');
  assert.equal(getReenvioConfig('formulario_contratacao').funcaoAlvoDe({ cargo_nivel: 'DIRETOR' }), 'DIRETOR');
  // Sem função no formulário, devolve null (a alçada cai na regra base).
  assert.equal(getReenvioConfig('nova_vaga').funcaoAlvoDe({}), null);
});
