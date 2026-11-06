import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTAS, CONTAS_CONTROLAVEIS, SEMPRE, FAT0, addDays, alerts, alertasFaturas, anexosOrfaos, celulaAbreLista, confSt, contasDoQuadro,
  erroConferencia, fatChip, fatChipOn, fatFiltrar, filtroAtivo, lastDay, resumoFaturas, tipoDoArquivo, voltaParaConferir, fdateTs, resumoCompetencia,
} from './regras.js';
import { linhaPagamento, nomeArquivoFaturas } from './exportar.js';
import { pagamentoFields, alojFields, valoresIniciais, coletar } from './formularios.js';

const HOJE = '2026-11-06';
const aloj = (extra = {}) => ({
  id: 'a1', nome: 'Prado', status: 'ativo', quartos: [], contas: [], pendencias: [], contas_controladas: [], created_at: '2026-01-01T00:00:00Z', ...extra,
});
const base = (pagamentos, alojamentos = [aloj(), aloj({ id: 'a2', nome: 'Buritis', centro_custo: 'VALE-CT01' })]) => ({
  alojamentos, estadias: [], itens: [], ocorrencias: [], pagamentos,
});
const pag = (extra) => ({
  id: extra.id, alojamento_id: 'a1', conta: 'Energia', competencia: '2026-11', status: 'pendente', anexos: [], conferencia_status: 'pendente', ...extra,
});

test('datas auxiliares: addDays vira o mês e lastDay sabe o fevereiro', () => {
  assert.equal(addDays('2026-11-29', 3), '2026-12-02');
  assert.equal(lastDay('2028-02'), '2028-02-29');
  assert.equal(lastDay('2026-11'), '2026-11-30');
  assert.equal(fdateTs(''), '');
  assert.match(fdateTs('2026-11-05T12:00:00Z'), /^0[45]\/11\/2026$/);
});

test('Manutenção é conta SEMPRE: tem coluna, abre lista e não é controlável', () => {
  assert.ok(CONTAS.includes('Manutenção'));
  assert.deepEqual(SEMPRE, ['Manutenção']);
  assert.ok(!CONTAS_CONTROLAVEIS.includes('Manutenção'));
  assert.ok(!CONTAS_CONTROLAVEIS.includes('Caução'));
  const ck = alojFields(false).find((c) => c.k === 'contas_controladas');
  assert.deepEqual(ck.opts, CONTAS_CONTROLAVEIS);
  assert.deepEqual(contasDoQuadro(['Aluguel'], ['Gás']), ['Aluguel', 'Gás', 'Manutenção']);
  assert.equal(celulaAbreLista('Manutenção', [{}]), true);
  assert.equal(celulaAbreLista('Energia', [{}]), false);
  assert.equal(celulaAbreLista('Energia', [{}, {}]), true);
});

test('Manutenção nunca vira "a lançar", mesmo que venha marcada no cadastro antigo', () => {
  const b = base([], [aloj({ contas_controladas: ['Aluguel'] })]);
  assert.deepEqual(resumoCompetencia(b, '2026-11', HOJE), { exp: 1, lanc: 0, pend: 0 });
});

test('confSt cai em pendente quando o valor é desconhecido ou vazio', () => {
  assert.equal(confSt({}), 'pendente');
  assert.equal(confSt({ conferencia_status: 'xyz' }), 'pendente');
  assert.equal(confSt({ conferencia_status: 'divergencia' }), 'divergencia');
});

test('fatFiltrar: competência, vencimento, conta, conferência, anexo, pagamento e busca', () => {
  const b = base([
    pag({ id: 'p1', vencimento: '2026-11-05', valor: 100, fornecedor: 'CEMIG' }),
    pag({ id: 'p2', vencimento: '2026-11-08', valor: 50, anexos: [{ path: 'x', nome: 'boleto-claro.pdf' }], conta: 'Internet' }),
    pag({ id: 'p3', vencimento: '2026-11-20', status: 'pago', conferencia_status: 'conferida', alojamento_id: 'a2' }),
    pag({ id: 'p4', competencia: '2026-10' }),
    pag({ id: 'p5', alojamento_id: 'sumiu' }),
  ]);
  const ids = (f) => fatFiltrar(b, { ...FAT0(), ...f }, HOJE).map((p) => p.id);
  assert.deepEqual(ids({}), ['p1', 'p2', 'p3', 'p4'], 'sem vencimento vai para o fim; sem alojamento sai');
  assert.deepEqual(ids({ comp: '2026-10' }), ['p4']);
  assert.deepEqual(ids({ de: '2026-11-06', ate: '2026-11-10' }), ['p2'], 'período exclui quem não tem vencimento');
  assert.deepEqual(ids({ sit: 'vencidas' }), ['p1']);
  assert.deepEqual(ids({ sit: 'pago' }), ['p3']);
  assert.deepEqual(ids({ sit: 'apagar' }), ['p1', 'p2', 'p4']);
  assert.deepEqual(ids({ conf: 'conferida' }), ['p3']);
  assert.deepEqual(ids({ anexo: 'com' }), ['p2']);
  assert.deepEqual(ids({ anexo: 'sem', conta: 'Energia' }), ['p1', 'p3', 'p4']);
  assert.deepEqual(ids({ q: 'cemig' }), ['p1']);
  assert.deepEqual(ids({ q: 'claro' }), ['p2'], 'busca também no nome do anexo');
  assert.deepEqual(ids({ q: 'vale-ct01' }), ['p3'], 'e no centro de custo');
  assert.deepEqual(ids({ aloj: 'a2' }), ['p3']);
});

test('atalhos: ligam o período certo, desligam no 2º clique e o reset parte do vazio', () => {
  const f0 = { ...FAT0(), comp: '2026-11' };
  const h = fatChip(f0, 'hoje', HOJE);
  assert.equal(h.de, HOJE);
  assert.equal(h.ate, HOJE);
  assert.equal(h.comp, '', 'período por vencimento larga a competência');
  assert.ok(fatChipOn(h, 'hoje', HOJE));
  const off = fatChip(h, 'hoje', HOJE);
  assert.equal(off.de, '');
  assert.ok(!fatChipOn(off, 'hoje', HOJE));
  assert.equal(fatChip(f0, '3d', HOJE).ate, '2026-11-09');
  assert.equal(fatChip(f0, '7d', HOJE).ate, '2026-11-13');
  const m = fatChip({ ...FAT0(), comp: '2026-02' }, 'mes', HOJE);
  assert.deepEqual([m.de, m.ate], ['2026-02-01', '2026-02-28']);
  const c = fatChip(FAT0(), 'conferir', HOJE);
  assert.deepEqual([c.conf, c.anexo], ['pendente', 'com']);
  assert.deepEqual(fatChip(c, 'conferir', HOJE), FAT0());
  const r = fatChip({ ...FAT0(), q: 'x', conta: 'Gás' }, 'vencidas', HOJE, true);
  assert.deepEqual(r, { ...FAT0(), sit: 'vencidas' });
  assert.deepEqual(fatChip(r, 'limpar', HOJE), FAT0());
  assert.equal(f0.de, '', 'não muda o objeto recebido');
  assert.ok(!filtroAtivo(FAT0()));
  assert.ok(filtroAtivo({ ...FAT0(), anexo: 'sem' }));
});

test('alertas de faturas: vencidas sem pagamento e as que vencem em até 3 dias', () => {
  const b = base([
    pag({ id: 'p1', vencimento: '2026-11-01', valor: 100 }),
    pag({ id: 'p2', vencimento: '2026-11-09', valor: 30, alojamento_id: 'a2' }),
    pag({ id: 'p3', vencimento: '2026-11-10', valor: 999 }),
    pag({ id: 'p4', vencimento: '2026-11-01', status: 'pago' }),
  ]);
  const al = alertasFaturas(b, HOJE);
  assert.equal(al.length, 2);
  assert.deepEqual(al.map((x) => [x.sev, x.chip, x.go]), [['bad', 'vencidas', 'pagamentos/faturas'], ['warn', '3d', 'pagamentos/faturas']]);
  assert.match(al[0].title, /^1 fatura vencida/);
  assert.match(al[0].text, /100,00 · Prado$/);
  assert.match(al[1].text, /30,00 · Buritis$/);
  assert.ok(alerts(b, HOJE).some((x) => x.chip === 'vencidas'), 'entra na lista do Início');
});

test('resumoFaturas soma o filtro e conta conferências', () => {
  const r = resumoFaturas([
    pag({ id: 'a', valor: 10, vencimento: '2026-11-01' }),
    pag({ id: 'b', valor: null, conferencia_status: 'conferida', anexos: [{ path: 'x' }] }),
    pag({ id: 'c', valor: 5, conferencia_status: 'divergencia' }),
  ], HOJE);
  assert.deepEqual(r, {
    total: 15, semValor: 1, comAnexo: 1, conferidas: 1, divergencias: 1, vencidas: 1, valorVencido: 10,
  });
});

test('voltaParaConferir só quando já conferido e mudou valor, vencimento ou anexos', () => {
  const conferido = pag({
    id: 'x', valor: 100, vencimento: '2026-11-10', conferencia_status: 'conferida', anexos: [{ path: 'a' }],
  });
  assert.equal(voltaParaConferir(conferido, { ...conferido, forma: 'PIX' }), false);
  assert.equal(voltaParaConferir(conferido, { ...conferido, valor: '100' }), false, 'mesmo número, mesmo valor');
  assert.equal(voltaParaConferir(conferido, { ...conferido, valor: 101 }), true);
  assert.equal(voltaParaConferir(conferido, { ...conferido, vencimento: '' }), true);
  assert.equal(voltaParaConferir(conferido, { ...conferido, anexos: [] }), true);
  assert.equal(voltaParaConferir({ ...conferido, conferencia_status: 'pendente' }, { valor: 1 }), false);
});

test('erroConferencia: divergência exige obs; pago sem valor exige data', () => {
  assert.equal(erroConferencia({}, { conferencia_status: 'divergencia', conferencia_obs: '  ' }), 'Descreva a divergência encontrada.');
  assert.equal(erroConferencia({ valor: null }, { conferencia_status: 'conferida', status: 'pago' }), 'Informe a data do pagamento.');
  assert.equal(erroConferencia({ valor: 10 }, { conferencia_status: 'conferida', status: 'pago' }), '');
  assert.equal(erroConferencia({}, { conferencia_status: 'divergencia', conferencia_obs: 'outro mês' }), '');
});

test('anexos: tipo pelo MIME ou pela extensão; órfãos ao cancelar e ao salvar', () => {
  assert.equal(tipoDoArquivo({ type: 'application/pdf', name: 'x' }), 'application/pdf');
  assert.equal(tipoDoArquivo({ type: '', name: 'Foto.JPG' }), 'image/jpeg');
  assert.equal(tipoDoArquivo({ type: 'text/plain', name: 'a.txt' }), '');
  const orig = [{ path: 'o1' }, { path: 'o2' }];
  assert.deepEqual(anexosOrfaos(orig, ['n1', 'n2'], [{ path: 'o1' }, { path: 'n1' }], false), ['n2'], 'cancelou: apaga só o novo que saiu da lista');
  assert.deepEqual(anexosOrfaos(orig, ['n1'], [], false), ['n1']);
  assert.deepEqual(anexosOrfaos(orig, ['n1', 'n2'], [{ path: 'o1' }, { path: 'n1' }], true), ['o2', 'n2']);
  assert.deepEqual(anexosOrfaos(undefined, [], [], true), []);
});

test('formulário de pagamento leva fornecedor, documento e anexos até o banco', () => {
  const campos = pagamentoFields(base([]));
  const ks = campos.map((c) => c.k);
  ['fornecedor', 'documento', 'anexos'].forEach((k) => assert.ok(ks.includes(k), k));
  const ini = valoresIniciais(campos, { alojamento_id: 'a1' });
  assert.deepEqual(ini.anexos, []);
  const out = coletar(campos, { ...ini, conta: 'Manutenção', anexos: [{ path: 'p', nome: 'nf.pdf' }] });
  assert.deepEqual(out.anexos, [{ path: 'p', nome: 'nf.pdf' }]);
});

test('planilha: colunas novas e nome do arquivo com o filtro', () => {
  const b = base([]);
  const l = linhaPagamento(b, pag({
    id: 'x', alojamento_id: 'a2', fornecedor: 'CEMIG', documento: '123', anexos: [{ nome: 'a.pdf' }, { nome: 'b.pdf' }], conferencia_status: 'divergencia', conferencia_obs: 'outro mês', conferido_por_nome: 'Lennon',
  }));
  assert.equal(l.Alojamento, 'Buritis');
  assert.equal(l['Centro de custo'], 'VALE-CT01');
  assert.equal(l['Faturas anexadas'], 'a.pdf | b.pdf');
  assert.equal(l['Conferência'], 'Divergência');
  assert.equal(l['Conferido por'], 'Lennon');
  assert.equal(nomeArquivoFaturas(FAT0()), 'PHD_Faturas_todas.xlsx');
  assert.equal(nomeArquivoFaturas({ ...FAT0(), comp: '2026-11', ate: '2026-11-30' }), 'PHD_Faturas_comp-2026-11_ate-2026-11-30.xlsx');
});
