import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dias360, mesesNoAno, montarResultado, multiplicadores, MULT_CARGO, resumoParaHub, soAtivas } from './calculo.ts';

const proximo = (a: number, b: number, msg = '') => assert.ok(Math.abs(a - b) < 1e-9, `${msg} ${a} != ${b}`);

test('dias360 segue o método europeu do Excel', () => {
  assert.equal(dias360('2026-01-01', '2027-01-01'), 360);
  assert.equal(dias360('2026-01-05', '2027-01-01'), 356);
  assert.equal(dias360('2026-01-31', '2026-03-31'), 60, 'dia 31 conta como 30 nas duas pontas');
});

test('mesesNoAno bate com a coluna TEMPO TR da planilha', () => {
  assert.equal(mesesNoAno('2023-03-01', 2026), 12, 'admitido antes do ano conta o ano inteiro');
  assert.equal(mesesNoAno('2026-01-05', 2026), 11.87);
  assert.equal(mesesNoAno('2026-05-18', 2026), 7.43);
});

test('mesesNoAno zera quem fica menos de 4 meses', () => {
  assert.equal(mesesNoAno('2026-09-28', 2026), 0, '3,1 meses');
  assert.equal(mesesNoAno('2026-09-01', 2026), 4, 'exatamente 4 meses já conta');
  assert.equal(mesesNoAno('2027-02-01', 2026), 0, 'admitido depois do ano');
});

test('multiplicadores: empresa em 75% e 60% do setor são 15% dos 25%', () => {
  const m = multiplicadores({ multEmpresa: 0.75, setorPct: 0.6, meses: 12, multCargo: 0.6, salario: 1000 });
  proximo(m.multEmpresa, 0.75);
  proximo(m.valorSetor, 0.15);
  proximo(m.multTotal, 0.9);
  proximo(m.multFinal, 0.54);
  proximo(m.valor as number, 540);
});

test('multiplicadores: tempo proporcional e setor zerado', () => {
  const m = multiplicadores({ multEmpresa: 0.75, setorPct: 0, meses: 6, multCargo: 1, salario: 1000 });
  proximo(m.multTotal, 0.75, 'a parte da empresa continua somando');
  proximo(m.multFinal, 0.375);
  proximo(m.valor as number, 375);
});

test('a tabela de cargo tem os nove cargos da planilha', () => {
  assert.equal(Object.keys(MULT_CARGO).length, 9);
  assert.equal(MULT_CARGO['OPERAÇÃOCLT'], 0.6);
  assert.equal(MULT_CARGO['GER EXEC'], 2.5);
});

// ---- montarResultado --------------------------------------------------------

const indicador = (meta: number, res: number, peso: number, regra = 'p90') => ({ un: 'pct', meta, res, peso, regra });
const painel = (projRes: number, ytdRes: number) => ({
  chave: 'painel',
  atualizado_em: '2026-11-04T11:00:00Z',
  valor: {
    indicadores: [
      { id: 'mol', nome: 'Margem', peso: 0.5, regra: 'p70', trigger: true, proj: { meta: 1, res: projRes }, ytd: { meta: 1, res: ytdRes } },
      { id: 'fat', nome: 'Faturamento', peso: 0.5, regra: 'p90', proj: { meta: 1, res: 1 }, ytd: { meta: 1, res: 1 } },
    ],
  },
});
const setores = {
  chave: 'setores',
  atualizado_em: '2026-11-04T12:00:00Z',
  valor: {
    setores: [
      { id: 'fin', nome: 'Financeiro e Contratos', ind: [indicador(1, 1, 0.6), indicador(1, 0, 0.4)] },
      { id: 'pmo', nome: 'PMO', ind: [indicador(1, 1, 1)] },
    ],
  },
};
const automaticos = { chave: 'automaticos', valor: { ate: '202610' } };
const colaborador = {
  id: 'c1', nome: 'FULANO', cod_ct: 'CORP>FIN', cargo_plr: 'OPERAÇÃOCLT', setor_hub: 'fin',
  salario: '1000', data_admissao: '2020-01-01', hub_chave: null,
};
const executivo = { id: 'g1', nome: 'CICLANA', hub_chave: 'ciclana', salario: null };
const executivoHub = {
  id: 'h1', chave: 'ciclana', nome: 'Ciclana', cargo: 'Gerente', salario: 100, mult_plr: 2, mult_bonus: 0,
  setores: ['pmo'], metas: [indicador(1, 1, 1)], bonus: [], ordem: 1,
};
const outroHub = { ...executivoHub, id: 'h2', chave: 'outra', nome: 'Outra', salario: 999, setores: [], ordem: 2 };

const resultado = (over = {}) => montarResultado({
  ano: 2026,
  papel: 'admin',
  veTodos: true,
  multEmpresa: 0.75,
  pessoas: [colaborador, executivo],
  parametros: [painel(1, 1), setores, automaticos],
  pessoasHub: [executivoHub, outroHub],
  ...over,
});

test('colaborador sai com o setor e a conta completa', () => {
  // Margem a 80% da meta: o fator do HUB seria 0,75, mas não entra na conta.
  const r = resultado({ parametros: [painel(0.8, 0.8), setores, automaticos] });
  const [c] = r.colaboradores;
  assert.equal(c.setorNome, 'Financeiro e Contratos');
  proximo(c.setorPct, 0.6);
  proximo(r.multEmpresa, 0.75);
  proximo(c.multEmpresa, 0.75);
  proximo(c.valorSetor, 0.15);
  proximo(c.multTotal, 0.9);
  proximo(c.valor, 0.9 * 0.6 * 1000);
});

test('o multiplicador da empresa editado vale nas pessoas, nos setores e nos totais', () => {
  const r = resultado({ multEmpresa: 0.8 });
  proximo(r.multEmpresa, 0.8);
  proximo(r.colaboradores[0].multTotal, 0.95);
  proximo(r.setores[0].multTotal, 0.95);
  proximo(r.totais.colaboradores, 0.95 * 0.6 * 1000);
  proximo(r.gerencia[0].plr, 200, 'a gerência não depende dele');
});

test('a gerência segue a projeção de fechamento, mesmo com o YTD do painel no gatilho', () => {
  // Margem do YTD a 60% da meta: naquela base o fator daria zero.
  const r = resultado({ parametros: [painel(1, 0.6), setores, automaticos] });
  assert.equal(r.gatilho, false);
  proximo(r.gerencia[0].fator, 1);
  assert.ok(r.gerencia[0].plr > 0);
});

test('gatilho acionado na projeção zera a gerência; o colaborador não muda', () => {
  const r = resultado({ parametros: [painel(0.6, 1), setores, automaticos] });
  assert.equal(r.gatilho, true);
  proximo(r.margemDaMeta as number, 0.6);
  proximo(r.colaboradores[0].multTotal, 0.75 + 0.15);
  assert.equal(r.gerencia[0].plr, 0, 'a gerência zera o PLR, como no HUB');
});

test('gerência vem inteira do HUB, sem passar pela conta do colaborador', () => {
  const [g] = resultado().gerencia;
  assert.equal(g.cargo, 'Gerente');
  assert.equal(g.salario, 100);
  // Metas próprias a 100% no lugar da linha individual não existem neste painel:
  // fator 1, salário 100 × múltiplo 2.
  proximo(g.fator, 1);
  proximo(g.plr, 200);
  proximo(g.total, 200);
  assert.equal(g.variavel, null, 'quem não tem variável não mostra zero');
});

test('dados do HUB de quem não está na lista visível não saem na resposta', () => {
  const r = resultado({ pessoas: [colaborador], veTodos: false, papel: 'usuario' });
  assert.equal(r.gerencia.length, 0);
  const texto = JSON.stringify(r);
  assert.doesNotMatch(texto, /"salario":(100|999)[,}]/, 'salário de executivo vazou');
  assert.doesNotMatch(texto, /Ciclana|Outra/, 'nome de executivo que não responde pelo setor vazou');
  assert.deepEqual(r.setores.map((s: { id: string }) => s.id), ['fin'], 'só o setor da própria linha');
});

test('resumo por setor soma as pessoas e os totais separam time e gerência', () => {
  const r = resultado({
    pessoas: [colaborador, { ...colaborador, id: 'c2', nome: 'BELTRANO', salario: '2000' }, executivo],
  });
  assert.equal(r.setores.length, 1, 'setor sem ninguém visível não aparece');
  assert.equal(r.setores[0].pessoas, 2);
  assert.equal(r.setores[0].responsavel, null, 'Financeiro sem responsável no HUB');
  proximo(r.setores[0].valorSetor, 0.15);
  proximo(r.setores[0].multTotal, 0.9);
  proximo(r.setores[0].valor, 0.9 * 0.6 * 3000);
  proximo(r.totais.colaboradores, 0.9 * 0.6 * 3000);
  proximo(r.totais.gerencia, 200);
  proximo(r.totais.geral, 0.9 * 0.6 * 3000 + 200);
  assert.equal(r.atualizadoEm, '2026-11-04T12:00:00Z', 'a data mais recente entre painel e setores');
  assert.equal(r.ytdAte, '202610');
});

test('setor ou cargo que não existem viram problema, não zero silencioso', () => {
  const r = resultado({
    pessoas: [
      { ...colaborador, id: 'a', nome: 'SEM SETOR', setor_hub: 'xyz' },
      { ...colaborador, id: 'b', nome: 'SEM CARGO', cargo_plr: 'ESTAGIARIO' },
      { ...executivo, id: 'c', nome: 'FORA DO HUB', hub_chave: 'nao_existe' },
    ],
  });
  assert.equal(r.colaboradores.length, 0);
  assert.equal(r.gerencia.length, 0);
  assert.equal(r.problemas.length, 3);
  assert.match(r.problemas[0], /SEM SETOR/);
  assert.match(r.problemas[1], /SEM CARGO/);
  assert.match(r.problemas[2], /FORA DO HUB/);
});

test('o HUB recebe o total dos colaboradores, sem nome nem salário de ninguém', () => {
  const r = resultado({
    pessoas: [colaborador, { ...colaborador, id: 'c2', nome: 'BELTRANO', salario: '2000' }, { ...colaborador, id: 'c3', nome: 'SEM SETOR', setor_hub: 'xyz' }],
  });
  const resumo = resumoParaHub(r);
  proximo(resumo.total, 0.9 * 0.6 * 3000);
  assert.equal(resumo.total, r.totais.colaboradores, 'o mesmo número da tela do portal');
  assert.equal(resumo.pessoas, 2);
  assert.equal(resumo.foraDaConta, 1);
  assert.equal(resumo.multEmpresa, 0.75);
  assert.deepEqual(Object.keys(resumo).sort(), ['ano', 'foraDaConta', 'multEmpresa', 'pessoas', 'total', 'ytdAte']);
  assert.doesNotMatch(JSON.stringify(resumo), /FULANO|BELTRANO|SEM SETOR/);
});

test('soAtivas tira só quem está desativado, como plr_pessoas_visiveis', () => {
  const nomes = soAtivas([
    { nome: 'ativo', colaboradores: { ativo: true } },
    { nome: 'desativado', colaboradores: { ativo: false } },
    { nome: 'ativo vazio', colaboradores: { ativo: null } },
    { nome: 'sem login', colaboradores: null },
  ]).map((p) => p.nome);
  assert.deepEqual(nomes, ['ativo', 'ativo vazio', 'sem login']);
});

test('gestor: as linhas são só as dele, e o resumo é o da empresa', () => {
  const deFora = { ...colaborador, id: 'c2', nome: 'DE FORA', setor_hub: 'pmo', salario: '5000' };
  const r = resultado({
    papel: 'gestor',
    veTodos: false,
    pessoas: [colaborador],
    pessoasDaEmpresa: [colaborador, deFora, executivo],
  });
  assert.deepEqual(r.colaboradores.map((c: { nome: string }) => c.nome), ['FULANO']);
  assert.equal(r.gerencia.length, 0);
  assert.deepEqual(r.setores.map((s: { id: string }) => s.id), ['fin'], 'só o setor dele');
  proximo(r.setores[0].valor, 0.9 * 0.6 * 1000, 'a soma do setor continua só do setor');
  proximo(r.totais.colaboradores, 0.9 * 0.6 * 1000 + 1 * 0.6 * 5000);
  proximo(r.totais.gerencia, 200);
  proximo(r.totais.geral, 0.9 * 0.6 * 1000 + 1 * 0.6 * 5000 + 200);
  const texto = JSON.stringify(r);
  assert.doesNotMatch(texto, /DE FORA|CICLANA/, 'nome de fora do setor vazou');
  assert.doesNotMatch(texto, /"salario":"?5000/, 'salário de fora do setor vazou');
});

test('gestor: quem fica fora da conta não aparece para ele, mas não entra na soma', () => {
  const r = resultado({
    papel: 'gestor',
    veTodos: false,
    pessoas: [colaborador],
    pessoasDaEmpresa: [colaborador, { ...colaborador, id: 'c3', nome: 'SEM SETOR', setor_hub: 'xyz' }],
  });
  proximo(r.totais.colaboradores, 0.9 * 0.6 * 1000);
  assert.deepEqual(r.problemas, []);
});

test('usuário: sem pessoasDaEmpresa os totais são só os da própria linha', () => {
  const r = resultado({ papel: 'usuario', veTodos: false, pessoas: [colaborador] });
  proximo(r.totais.geral, 0.9 * 0.6 * 1000);
  assert.equal(r.totais.gerencia, 0);
});

test('quem vê só a própria linha não recebe a lista de problemas', () => {
  const r = resultado({
    veTodos: false,
    papel: 'usuario',
    pessoas: [{ ...colaborador, setor_hub: 'xyz' }],
  });
  assert.deepEqual(r.problemas, []);
});
