import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PAPEIS, avaliarAlcada, avaliarPagamento, avaliarGenteCultura,
  valorEnquadramentoContrato, classificarLideranca, casoGenteCultura, funcaoMaisSenior,
} from './alcadas.js';

const P = PAPEIS;
const papeis = (r) => r.papeis;

// ---------------------------------------------------------------------------
// §2.1 — Compras e Despesas: limites das faixas
// ---------------------------------------------------------------------------

test('compras: faixas pelo teto inclusivo (2k / 5k / 20k / 50k / acima)', () => {
  const nivel = (v) => avaliarAlcada({ tabela: 'compras', valor: v }).nivelFinal;
  assert.equal(nivel(0), 1);
  assert.equal(nivel(2000), 1);
  assert.equal(nivel(2000.01), 2);
  assert.equal(nivel(5000), 2);
  assert.equal(nivel(5000.01), 3);
  assert.equal(nivel(20000), 3);
  assert.equal(nivel(20000.01), 4);
  assert.equal(nivel(50000), 4);
  assert.equal(nivel(50000.01), 5);
});

test('compras: a faixa 5k-20k exige dupla aprovação COO + Gerente Financeiro', () => {
  assert.deepEqual(papeis(avaliarAlcada({ tabela: 'compras', valor: 10000 })),
    [P.COO, P.GERENTE_FINANCEIRO]);
});

test('compras: acima de 20k vai ao CEO; acima de 50k vai ao Conselho', () => {
  assert.deepEqual(papeis(avaliarAlcada({ tabela: 'compras', valor: 30000 })), [P.CEO]);
  assert.deepEqual(papeis(avaliarAlcada({ tabela: 'compras', valor: 80000 })), [P.CONSELHO]);
});

// ---------------------------------------------------------------------------
// Modificador-base: fora do orçamento sobe +1 nível em QUALQUER valor
// ---------------------------------------------------------------------------

test('fora do orçamento sobe +1 nível, mesmo no valor mais baixo', () => {
  const r = avaliarAlcada({ tabela: 'compras', valor: 100, modificadores: ['fora_orcamento'] });
  assert.equal(r.nivelBase, 1);
  assert.equal(r.nivelFinal, 2);
  assert.deepEqual(r.papeis, [P.GERENTE_EXECUTIVO]);
});

test('fora do orçamento no topo da tabela não estoura o teto', () => {
  const r = avaliarAlcada({ tabela: 'compras', valor: 90000, modificadores: ['fora_orcamento'] });
  assert.equal(r.nivelBase, 5);
  assert.equal(r.nivelFinal, 5);
});

test('fora do orçamento registra exceção e dispara alerta à diretoria', () => {
  const r = avaliarAlcada({ tabela: 'compras', valor: 1000, modificadores: ['fora_orcamento'] });
  assert.equal(r.alertaDiretoria, true);
  assert.equal(r.excecoes.length, 1);
  assert.match(r.excecoes[0], /Fora do orçamento/);
});

test('sem modificador não há exceção nem alerta', () => {
  const r = avaliarAlcada({ tabela: 'compras', valor: 1000 });
  assert.deepEqual(r.excecoes, []);
  assert.equal(r.alertaDiretoria, false);
});

test('modificador de contrato não vale em compras', () => {
  const r = avaliarAlcada({ tabela: 'compras', valor: 1000, modificadores: ['prazo_maior_12m'] });
  assert.equal(r.nivelFinal, 1);
  assert.deepEqual(r.modificadores, []);
});

// ---------------------------------------------------------------------------
// §3 — Contratos
// ---------------------------------------------------------------------------

test('contrato recorrente é anualizado antes de enquadrar', () => {
  const { valor, base } = valorEnquadramentoContrato({ tipoContrato: 'recorrente', valorMensal: 2000 });
  assert.equal(valor, 24000);
  assert.match(base, /anualizado/);
  // 2.000/mês parece faixa 1, mas anualizado (24.000) cai na faixa do CEO.
  assert.deepEqual(papeis(avaliarAlcada({ tabela: 'contratos', valor })), [P.CEO]);
});

test('contrato pontual usa o valor total', () => {
  const { valor } = valorEnquadramentoContrato({ tipoContrato: 'pontual', valor: 3000 });
  assert.equal(valor, 3000);
});

test('modificadores de contrato acumulam (+1 cada)', () => {
  const r = avaliarAlcada({
    tabela: 'contratos', valor: 1000,
    modificadores: ['prazo_maior_12m', 'multa_rescisoria_relevante'],
  });
  assert.equal(r.nivelBase, 1);
  assert.equal(r.nivelFinal, 3);
  assert.deepEqual(r.papeis, [P.COO, P.GERENTE_FINANCEIRO]);
});

test('contrato fora do orçamento + prazo longo + multa = +3 níveis', () => {
  const r = avaliarAlcada({
    tabela: 'contratos', valor: 1000,
    modificadores: ['fora_orcamento', 'prazo_maior_12m', 'multa_rescisoria_relevante'],
  });
  assert.equal(r.nivelFinal, 4);
  assert.equal(r.degrausAplicados, 3);
  assert.equal(r.excecoes.length, 3);
});

test('cláusula atípica exige parecer do Jurídico sem mudar o nível', () => {
  const r = avaliarAlcada({ tabela: 'contratos', valor: 1000, gatilhos: ['clausula_atipica'] });
  assert.equal(r.nivelFinal, 1);
  assert.deepEqual(r.pareceres, [P.JURIDICO]);
  assert.equal(r.alertaDiretoria, true);
});

test('CAPEX relevante força o último nível independentemente do valor', () => {
  const r = avaliarAlcada({ tabela: 'compras', valor: 10, gatilhos: ['capex_relevante'] });
  assert.equal(r.nivelFinal, 5);
  assert.deepEqual(r.papeis, [P.CONSELHO]);
});

// ---------------------------------------------------------------------------
// §4 — Pagamentos
// ---------------------------------------------------------------------------

test('pagamento orçado: Financeiro executa sem nova aprovação', () => {
  const r = avaliarPagamento({ valor: 999999, orcado: true });
  assert.deepEqual(r.papeis, []);
  assert.equal(r.nivelFinal, 0);
  assert.equal(r.alertaDiretoria, false);
});

test('pagamento não orçado segue a tabela própria e alerta a diretoria', () => {
  const ate5k = avaliarPagamento({ valor: 5000, orcado: false });
  assert.deepEqual(ate5k.papeis, [P.GERENTE_EXECUTIVO, P.FINANCEIRO]);
  assert.equal(ate5k.alertaDiretoria, true);

  assert.deepEqual(avaliarPagamento({ valor: 20000, orcado: false }).papeis, [P.COO, P.FINANCEIRO]);
  assert.deepEqual(avaliarPagamento({ valor: 20000.01, orcado: false }).papeis, [P.CEO]);
});

test('distribuição de lucros vai ao Conselho mesmo se orçada', () => {
  const r = avaliarPagamento({ valor: 1000, orcado: true, gatilhos: ['distribuicao_lucros'] });
  assert.ok(r.papeis.includes(P.CONSELHO));
});

test('aplicação relevante exige Financeiro + CEO', () => {
  const r = avaliarPagamento({ valor: 1000, orcado: false, gatilhos: ['aplicacao_relevante'] });
  assert.ok(r.papeis.includes(P.FINANCEIRO));
  assert.ok(r.papeis.includes(P.CEO));
});

// ---------------------------------------------------------------------------
// §1 — Comercial (Hunter x Farmer)
// ---------------------------------------------------------------------------

test('comercial hunter: até 1M é Contribuição (Morais)', () => {
  assert.deepEqual(papeis(avaliarAlcada({ tabela: 'comercial_hunter', valor: 1000000 })), [P.COO]);
});

test('comercial hunter: acima de 3M é Nery', () => {
  assert.deepEqual(papeis(avaliarAlcada({ tabela: 'comercial_hunter', valor: 3000001 })), [P.CEO]);
});

test('comercial farmer difere do hunter na primeira faixa (segregação Hunter/Farmer)', () => {
  const hunter = papeis(avaliarAlcada({ tabela: 'comercial_hunter', valor: 500000 }));
  const farmer = papeis(avaliarAlcada({ tabela: 'comercial_farmer', valor: 500000 }));
  assert.deepEqual(hunter, [P.COO]);
  assert.deepEqual(farmer, [P.DIRETOR_COMERCIAL, P.GERENTE_EXECUTIVO]);
  assert.notDeepEqual(hunter, farmer);
});

test('MC/LL abaixo do piso: Daniela participa no hunter e NÃO no farmer', () => {
  const h = avaliarAlcada({ tabela: 'comercial_hunter', valor: 100, gatilhos: ['mc_ll_abaixo_piso'] });
  const f = avaliarAlcada({ tabela: 'comercial_farmer', valor: 100, gatilhos: ['mc_ll_abaixo_piso'] });
  assert.ok(h.papeis.includes(P.GERENTE_FINANCEIRO));
  assert.ok(!f.papeis.includes(P.GERENTE_FINANCEIRO));
  assert.ok(f.papeis.includes(P.CEO) && f.papeis.includes(P.COO));
});

test('desconto fora da tabela acrescenta Daniela em qualquer origem', () => {
  const r = avaliarAlcada({ tabela: 'comercial_farmer', valor: 100, gatilhos: ['desconto_fora_tabela'] });
  assert.ok(r.papeis.includes(P.GERENTE_FINANCEIRO));
});

test('LTA estratégico leva ao CEO', () => {
  const r = avaliarAlcada({ tabela: 'comercial_hunter', valor: 100, gatilhos: ['lta_estrategico'] });
  assert.ok(r.papeis.includes(P.CEO));
});

test('papéis nunca duplicam quando o gatilho repete quem já está na faixa', () => {
  const r = avaliarAlcada({ tabela: 'comercial_hunter', valor: 5000000, gatilhos: ['lta_estrategico'] });
  assert.deepEqual(r.papeis, [P.CEO]);
});

// ---------------------------------------------------------------------------
// §5 — Gente & Cultura e a Trava Headcount
// ---------------------------------------------------------------------------

test('contratação dentro do headcount: Gerente + RH', () => {
  const r = avaliarGenteCultura({ caso: 'contratacao_dentro_headcount' });
  assert.deepEqual(r.papeis, [P.GERENTE, P.RH]);
  assert.equal(r.alertaDiretoria, false);
});

test('vaga nova fora do quadro: Diretor da área + Financeiro', () => {
  assert.deepEqual(avaliarGenteCultura({ caso: 'vaga_nova_fora_quadro' }).papeis,
    [P.DIRETOR_AREA, P.FINANCEIRO]);
});

test('liderança: backoffice vai ao CEO, operação vai ao COO', () => {
  assert.deepEqual(avaliarGenteCultura({ caso: 'lideranca', area: 'backoffice' }).papeis, [P.CEO]);
  assert.deepEqual(avaliarGenteCultura({ caso: 'lideranca', area: 'operacao' }).papeis, [P.COO]);
});

test('desligamento de liderança segue a mesma divisão por área', () => {
  assert.deepEqual(avaliarGenteCultura({ caso: 'desligamento_lideranca', area: 'backoffice' }).papeis, [P.CEO]);
  assert.deepEqual(avaliarGenteCultura({ caso: 'desligamento_lideranca', area: 'operacao' }).papeis, [P.COO]);
});

test('trava headcount acrescenta o CEO ao final em qualquer caso', () => {
  const r = avaliarGenteCultura({ caso: 'contratacao_dentro_headcount', altaLideranca: true });
  assert.deepEqual(r.papeis, [P.GERENTE, P.RH, P.CEO]);
  assert.equal(r.alertaDiretoria, true);
  assert.match(r.excecoes[0], /Trava Headcount/);
});

test('trava headcount não duplica o CEO: move para o fim como decisão final', () => {
  const r = avaliarGenteCultura({ caso: 'lideranca', area: 'backoffice', altaLideranca: true });
  assert.deepEqual(r.papeis, [P.CEO]);
});

test('trava headcount em liderança de operação: COO decide e o CEO fecha', () => {
  const r = avaliarGenteCultura({ caso: 'desligamento_lideranca', area: 'operacao', altaLideranca: true });
  assert.deepEqual(r.papeis, [P.COO, P.CEO]);
});

// ---------------------------------------------------------------------------
// Classificação de liderança — cargos REAIS do cadastro
// ---------------------------------------------------------------------------

test('alta liderança: CEO, diretores e gerente executivo', () => {
  assert.equal(classificarLideranca('CEO'), 'alta_lideranca');
  assert.equal(classificarLideranca('DIRETOR DE OPERAÇÕES'), 'alta_lideranca');
  assert.equal(classificarLideranca('Diretor Comercial'), 'alta_lideranca');
  assert.equal(classificarLideranca('GERENTE EXECUTIVO'), 'alta_lideranca');
});

test('gerente executivo não é rebaixado a liderança comum pela ordem das listas', () => {
  // "GERENTE EXECUTIVO" também casa com "GERENTE": se a ordem invertesse,
  // ele cairia em 'lideranca' e escaparia da Trava Headcount.
  assert.notEqual(classificarLideranca('GERENTE EXECUTIVO'), 'lideranca');
});

test('liderança comum: gerente, head e coordenador', () => {
  assert.equal(classificarLideranca('GERENTE DE PLANEJAMENTO'), 'lideranca');
  assert.equal(classificarLideranca('GERENTE FINANCEIRO'), 'lideranca');
  assert.equal(classificarLideranca('HEAD DE QUALIDADE'), 'lideranca');
  assert.equal(classificarLideranca('COORDENADOR ADMINISTRATIVO'), 'lideranca');
  assert.equal(classificarLideranca('COORDENADORA DE MARKETING '), 'lideranca');
});

test('não-liderança: consultor, especialista, analista, técnico', () => {
  for (const f of ['CONSULTOR DE PLANEJAMENTO PL', 'ESPECIALISTA DE PLANEJAMENTO',
    'ANALISTA FINANCEIRO', 'TECNICO PLANEJAMENTO MEDICAO', 'AUXILIAR DE SERVIÇOS GERAIS']) {
    assert.equal(classificarLideranca(f), 'nenhuma', f);
  }
});

test('função vazia ou nula não é liderança', () => {
  assert.equal(classificarLideranca(''), 'nenhuma');
  assert.equal(classificarLideranca(null), 'nenhuma');
  assert.equal(classificarLideranca(undefined), 'nenhuma');
});

// ---------------------------------------------------------------------------
// Mapeamento requisição DP -> caso do §5
// ---------------------------------------------------------------------------

test('desligamento de não-liderança não tem alçada própria', () => {
  assert.equal(casoGenteCultura('desligamento', 'CONSULTOR DE PLANEJAMENTO PL'), null);
});

test('desligamento de liderança cai no caso do §5.2', () => {
  assert.deepEqual(casoGenteCultura('desligamento', 'COORDENADOR DE PLANEJAMENTO'),
    { caso: 'desligamento_lideranca', altaLideranca: false });
});

test('desligamento de alta liderança aciona a Trava Headcount', () => {
  assert.deepEqual(casoGenteCultura('desligamento', 'DIRETOR DE OPERAÇÕES'),
    { caso: 'desligamento_lideranca', altaLideranca: true });
});

test('alteração de cargo de liderança cai no caso de liderança', () => {
  assert.deepEqual(casoGenteCultura('aumento_salario', 'GERENTE DE PMO'),
    { caso: 'lideranca', altaLideranca: false });
});

test('contratação de não-liderança é dentro do headcount', () => {
  assert.deepEqual(casoGenteCultura('formulario_contratacao', 'ANALISTA DE RH'),
    { caso: 'contratacao_dentro_headcount', altaLideranca: false });
});

test('nova vaga fora do quadro vai a Diretor da área + Financeiro', () => {
  const r = casoGenteCultura('nova_vaga', 'ANALISTA DE MARKETING', true);
  assert.equal(r.caso, 'vaga_nova_fora_quadro');
  assert.deepEqual(avaliarGenteCultura(r).papeis, [PAPEIS.DIRETOR_AREA, PAPEIS.FINANCEIRO]);
});

test('nova vaga de diretor fora do quadro soma a Trava Headcount', () => {
  const r = casoGenteCultura('nova_vaga', 'DIRETOR DE OPERAÇÕES', true);
  assert.equal(r.altaLideranca, true);
  assert.deepEqual(avaliarGenteCultura(r).papeis,
    [PAPEIS.DIRETOR_AREA, PAPEIS.FINANCEIRO, PAPEIS.CEO]);
});

test('promoção para liderança não escapa da alçada (cargo mais sênior manda)', () => {
  const atual = 'CONSULTOR DE PLANEJAMENTO SR';
  const proposto = 'COORDENADOR DE PLANEJAMENTO';
  assert.equal(funcaoMaisSenior(atual, proposto), proposto);
  assert.deepEqual(casoGenteCultura('aumento_salario', funcaoMaisSenior(atual, proposto)),
    { caso: 'lideranca', altaLideranca: false });
  // Olhar só o cargo atual deixaria a promoção passar sem aprovação de alçada.
  assert.equal(casoGenteCultura('aumento_salario', atual), null);
});

test('rebaixamento mantém a alçada do cargo mais alto', () => {
  assert.equal(funcaoMaisSenior('DIRETOR DE OPERAÇÕES', 'ANALISTA FINANCEIRO'), 'DIRETOR DE OPERAÇÕES');
});

test('tipos sem regra no documento não injetam aprovador', () => {
  assert.equal(casoGenteCultura('ajuda_custo', 'GERENTE DE PMO'), null);
  assert.equal(casoGenteCultura('mapeamento', 'DIRETOR DE OPERAÇÕES'), null);
});

test('ponta a ponta: desligar um diretor de operação exige COO e depois CEO', () => {
  const c = casoGenteCultura('desligamento', 'DIRETOR DE OPERAÇÕES');
  const r = avaliarGenteCultura({ ...c, area: 'operacao' });
  assert.deepEqual(r.papeis, [PAPEIS.COO, PAPEIS.CEO]);
  assert.equal(r.alertaDiretoria, true);
});

// ---------------------------------------------------------------------------
// Robustez
// ---------------------------------------------------------------------------

test('tabela desconhecida falha alto em vez de aprovar em branco', () => {
  assert.throws(() => avaliarAlcada({ tabela: 'inexistente', valor: 1 }), /desconhecida/);
});

test('caso de Gente & Cultura desconhecido falha alto', () => {
  assert.throws(() => avaliarGenteCultura({ caso: 'nao_existe' }), /desconhecido/);
});

test('valor ausente ou inválido cai no nível mais baixo, nunca em nenhum aprovador', () => {
  const r = avaliarAlcada({ tabela: 'compras', valor: undefined });
  assert.equal(r.nivelFinal, 1);
  assert.ok(r.papeis.length > 0);
});
