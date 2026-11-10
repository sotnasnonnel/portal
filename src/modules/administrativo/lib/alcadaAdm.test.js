import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SERVICOS_COM_ALCADA, alcadaDoServico, valorParaAlcada, decidirAprovacao, cadeiaDoFluxo,
  juntarCadeias, papeisForaDaCadeia, escadaDoOrganograma, ehGerente, ehAcimaDeGerente, ehGerencia,
  equipeDoOrganograma,
} from './alcadaAdm.js';
import { avaliarAlcada } from '../../../config/alcadas.js';

test('só os três serviços com gasto entram na alçada', () => {
  assert.deepEqual(Object.keys(SERVICOS_COM_ALCADA).sort(), [
    'compra/solicitacao-compra',
    'frota/recarga-ticket-log',
    'viagem-hospedagem/locacao-imovel',
  ]);
  assert.equal(alcadaDoServico('uber', 'viagem-uber'), null);
});

test('serviço com valor usa alçada, mesmo sem exigir aprovação no cadastro', () => {
  const d = decidirAprovacao({
    classe: 'compra', servico: 'solicitacao-compra',
    campos: { valor_base: 12400 }, exigeAprovacao: false,
  });
  assert.equal(d.modo, 'alcada');
  assert.equal(d.valor, 12400);
  assert.equal(d.tabela, 'administrativo');
});

// O erro que uma alçada existe para evitar: sem valor, a faixa mais baixa
// seria escolhida por omissão.
test('serviço de gasto sem valor não passa — bloqueia em vez de cair na faixa mais baixa', () => {
  for (const vazio of [undefined, null, '', 'abc']) {
    const d = decidirAprovacao({
      classe: 'compra', servico: 'solicitacao-compra', campos: { valor_base: vazio },
    });
    assert.equal(d.modo, 'alcada');
    assert.match(d.erro, /valor base/i);
    assert.equal(d.valor, undefined);
  }
});

test('valor zero é valor: enquadra na primeira faixa, não bloqueia', () => {
  const d = decidirAprovacao({ classe: 'frota', servico: 'recarga-ticket-log', campos: { valor: 0 } });
  assert.equal(d.valor, 0);
  assert.equal(d.erro, undefined);
});

test('serviço sem gasto segue o cadastro: fluxo quando exige, nada quando não', () => {
  const base = { classe: 'uber', servico: 'viagem-uber', campos: {} };
  assert.equal(decidirAprovacao({ ...base, exigeAprovacao: true }).modo, 'fluxo');
  assert.equal(decidirAprovacao({ ...base, exigeAprovacao: false }).modo, 'nenhum');
});

test('valorParaAlcada aceita número em texto e recusa lixo', () => {
  const def = SERVICOS_COM_ALCADA['compra/solicitacao-compra'];
  assert.equal(valorParaAlcada({ valor_base: '1500' }, def), 1500);
  assert.equal(valorParaAlcada({ valor_base: 'mil e quinhentos' }, def), null);
  assert.equal(valorParaAlcada({}, def), null);
});

// A cadeia da classe manda; o geral só cobre quem não tem regra própria.
test('cadeiaDoFluxo: classe tem precedência sobre o geral', () => {
  const fluxos = [
    { classe: '', aprovadores: ['geral1'] },
    { classe: 'compra', aprovadores: ['compra1', 'compra2'] },
  ];
  assert.deepEqual(cadeiaDoFluxo(fluxos, 'compra'), ['compra1', 'compra2']);
  assert.deepEqual(cadeiaDoFluxo(fluxos, 'frota'), ['geral1']);
  assert.deepEqual(cadeiaDoFluxo([], 'frota'), []);
});

// Cadeia vazia cadastrada de propósito não é o mesmo que "não cadastrado":
// significa "esta classe não passa por ninguém".
test('cadeia vazia da classe não cai de volta no geral', () => {
  const fluxos = [{ classe: '', aprovadores: ['geral1'] }, { classe: 'frota', aprovadores: [] }];
  assert.deepEqual(cadeiaDoFluxo(fluxos, 'frota'), []);
});

// ---- gerente antes da faixa ----

test('juntarCadeias preserva a ordem: gerente primeiro, faixa depois', () => {
  assert.deepEqual(juntarCadeias(['gerente'], ['coo', 'financeiro']),
    ['gerente', 'coo', 'financeiro']);
});

// Na faixa até R$ 2.000 o papel da alçada É o gerente: sem dedução, ele
// receberia duas etapas seguidas do mesmo pedido.
test('quem já está na cadeia não aprova duas vezes', () => {
  assert.deepEqual(juntarCadeias(['gerente'], ['gerente']), ['gerente']);
  assert.deepEqual(juntarCadeias(['a', 'b'], ['b', 'c']), ['a', 'b', 'c']);
});

test('sem gerente, a cadeia é só a da faixa', () => {
  assert.deepEqual(juntarCadeias([], ['ceo']), ['ceo']);
});

test('ids vazios não viram etapa', () => {
  assert.deepEqual(juntarCadeias(['', null, 'a'], [undefined, 'a']), ['a']);
});

// ---- papel que deveria vir da cadeia mas veio da lista fixa ----

const etapa = (papel, origem) => ({ papel, candidatos: [{ id: 'x', nome: 'X', origem }] });

test('papel de cadeia resolvido pela lista fixa é acusado', () => {
  assert.deepEqual(papeisForaDaCadeia([etapa('GERENTE_EXECUTIVO', 'ATRIBUIDO')]),
    ['GERENTE_EXECUTIVO']);
});

test('papel de cadeia achado no organograma passa', () => {
  assert.deepEqual(papeisForaDaCadeia([etapa('GERENTE_EXECUTIVO', 'CADEIA')]), []);
  assert.deepEqual(papeisForaDaCadeia([etapa('GERENTE', 'CADEIA')]), []);
});

// COO, CEO e Gerente Financeiro são cargos únicos da empresa: vir da lista fixa
// é o certo para eles, e bloquear ali travaria todas as faixas altas.
test('papel global não é cobrado da cadeia', () => {
  assert.deepEqual(papeisForaDaCadeia([
    etapa('COO', 'ATRIBUIDO'),
    etapa('GERENTE_FINANCEIRO', 'ATRIBUIDO'),
    etapa('CEO', 'FUNCAO'),
  ]), []);
});

// Papel de grupo traz vários candidatos: basta um vir da cadeia para valer.
test('grupo com ao menos um da cadeia passa', () => {
  assert.deepEqual(papeisForaDaCadeia([{
    papel: 'GERENTE_EXECUTIVO',
    candidatos: [{ id: 'a', origem: 'ATRIBUIDO' }, { id: 'b', origem: 'CADEIA' }],
  }]), []);
});

// ---- faixas do Atendimento (decisão da diretoria, ago/2026) ----
// Até 5 mil só o fluxo da pessoa; de 5 a 20 mil a dupla Morais + Daniela;
// acima de 20 mil o dono da empresa entra ao final, somando à dupla.

test('até R$ 5.000 a faixa não exige papel nenhum', () => {
  for (const v of [1, 1500, 4000, 5000]) {
    assert.deepEqual(avaliarAlcada({ tabela: 'administrativo', valor: v }).papeis, [], `R$ ${v}`);
  }
});

test('de R$ 5.000 a R$ 20.000 é a dupla COO + Gerente Financeiro', () => {
  for (const v of [5000.01, 12400, 20000]) {
    assert.deepEqual(avaliarAlcada({ tabela: 'administrativo', valor: v }).papeis,
      ['COO', 'GERENTE_FINANCEIRO'], `R$ ${v}`);
  }
});

// "Entra o dono" é soma, não troca: acima de 20 mil a dupla continua na cadeia.
test('acima de R$ 20.000 o CEO entra sem tirar a dupla', () => {
  for (const v of [20000.01, 45000, 90000]) {
    assert.deepEqual(avaliarAlcada({ tabela: 'administrativo', valor: v }).papeis,
      ['COO', 'GERENTE_FINANCEIRO', 'CEO'], `R$ ${v}`);
  }
});

// Os dois limites são inclusivos: o valor exato fica sempre na faixa de baixo.
test('R$ 5.000 e R$ 20.000 exatos ficam na faixa de baixo', () => {
  assert.deepEqual(avaliarAlcada({ tabela: 'administrativo', valor: 5000 }).papeis, []);
  assert.equal(avaliarAlcada({ tabela: 'administrativo', valor: 5000.01 }).papeis.length, 2);
  assert.equal(avaliarAlcada({ tabela: 'administrativo', valor: 20000 }).papeis.length, 2);
  assert.equal(avaliarAlcada({ tabela: 'administrativo', valor: 20001 }).papeis.length, 3);
});

// O Financeiro segue o Documento Parte 3 e não pode ser arrastado por esta
// decisão, que vale só para o chamado do Atendimento.
test('a tabela do Financeiro continua intacta', () => {
  assert.deepEqual(avaliarAlcada({ tabela: 'compras', valor: 3200 }).papeis, ['GERENTE_EXECUTIVO']);
  assert.deepEqual(avaliarAlcada({ tabela: 'compras', valor: 45000 }).papeis, ['CEO']);
});

// ---------------------------------------------------------------------------
// Escada do organograma — Coordenador → Gerente
// Os casos abaixo são cadeias REAIS do organograma da empresa (out/2026).
// ---------------------------------------------------------------------------

const escada = (cadeia) => escadaDoOrganograma(cadeia).map((p) => `${p.papel}:${p.nome}`);

test('caso mais comum: coordenador da pessoa e o gerente executivo acima dele', () => {
  assert.deepEqual(escada([
    { nivel: 1, id: 'c', nome: 'Coord', funcao: 'COORDENADOR DE PLANEJAMENTO' },
    { nivel: 2, id: 'g', nome: 'GerEx', funcao: 'GERENTE EXECUTIVO' },
    { nivel: 3, id: 'd', nome: 'Diretor', funcao: 'DIRETOR DE OPERAÇÕES' },
  ]), ['Gestor direto:Coord', 'Gerente:GerEx']);
});

// Sem isto, quem responde a um gerente teria o pedido subindo para a diretoria,
// e quem responde a um diretor iria ao CEO — por menor que fosse o chamado.
test('superior direto que já é gerência encerra a escada nele', () => {
  for (const funcao of ['GERENTE DE PLANEJAMENTO', 'GERENTE EXECUTIVO', 'DIRETOR DE OPERAÇÕES', 'CEO']) {
    assert.deepEqual(escada([
      { nivel: 1, id: 'a', nome: 'Chefe', funcao },
      { nivel: 2, id: 'b', nome: 'Acima', funcao: 'CEO' },
    ]), ['Gestor direto:Chefe'], funcao);
  }
});

// Comercial: o coordenador responde direto à diretoria, não há gerente na
// cadeia. O degrau existe, só está mais acima — cair fora dele deixaria o
// pedido com um aprovador só.
test('sem gerente na cadeia, o degrau vira o primeiro diretor', () => {
  assert.deepEqual(escada([
    { nivel: 1, id: 'c', nome: 'Coord', funcao: 'COORDENADOR COMERCIAL' },
    { nivel: 2, id: 'd', nome: 'Morais', funcao: 'DIRETOR DE OPERAÇÕES' },
    { nivel: 3, id: 'e', nome: 'Nery', funcao: 'CEO' },
  ]), ['Gestor direto:Coord', 'Gerente:Morais']);
});

test('gerente é preferido ao diretor, mesmo com o diretor mais perto', () => {
  assert.deepEqual(escada([
    { nivel: 1, id: 's', nome: 'Sênior', funcao: 'CONSULTOR PLANEJAMENTO SR' },
    { nivel: 2, id: 'd', nome: 'Diretor', funcao: 'DIRETOR DE OPERAÇÕES' },
    { nivel: 3, id: 'g', nome: 'GerEx', funcao: 'GERENTE EXECUTIVO' },
  ]), ['Gestor direto:Sênior', 'Gerente:GerEx']);
});

// Chamado #376: Adailton → Alessandro (coordenador) → Ivano (Head) → Leonardo.
// O Head é o degrau de gerência; pulá-lo mandava o pedido ao Gerente Executivo.
test('Head conta como gerente: o coordenador sobe para o Head, não acima dele', () => {
  assert.deepEqual(escada([
    { nivel: 1, id: 'c', nome: 'Alessandro', funcao: 'COORDENADOR DE PLANEJAMENTOS' },
    { nivel: 2, id: 'h', nome: 'Ivano', funcao: 'HEAD DE QUALIDADE' },
    { nivel: 3, id: 'g', nome: 'Leonardo', funcao: 'GERENTE EXECUTIVO' },
  ]), ['Gestor direto:Alessandro', 'Gerente:Ivano']);
});

test('quem responde direto ao Head para nele', () => {
  assert.deepEqual(escada([
    { nivel: 1, id: 'h', nome: 'Ivano', funcao: 'HEAD DE QUALIDADE' },
    { nivel: 2, id: 'g', nome: 'Leonardo', funcao: 'GERENTE EXECUTIVO' },
  ]), ['Gestor direto:Ivano']);
});

// 12 pessoas hoje respondem a um consultor sênior, que não é liderança: sem
// subir, elas ficariam com um aprovador que não responde por orçamento nenhum.
test('superior direto sem cargo de liderança ainda leva ao gerente', () => {
  assert.deepEqual(escada([
    { nivel: 1, id: 's', nome: 'Sênior', funcao: 'CONSULTOR PLANEJAMENTO SR' },
    { nivel: 2, id: 'g', nome: 'Gerente', funcao: 'GERENTE DE PLANEJAMENTO' },
  ]), ['Gestor direto:Sênior', 'Gerente:Gerente']);
});

test('quem não tem ninguém acima fica sem escada — o chamado é barrado depois', () => {
  assert.deepEqual(escadaDoOrganograma([]), []);
  assert.deepEqual(escadaDoOrganograma(undefined), []);
});

test('a escada respeita o nível, não a ordem em que a RPC devolveu', () => {
  assert.deepEqual(escada([
    { nivel: 2, id: 'g', nome: 'GerEx', funcao: 'GERENTE EXECUTIVO' },
    { nivel: 1, id: 'c', nome: 'Coord', funcao: 'COORDENADOR DE PLANEJAMENTO' },
  ]), ['Gestor direto:Coord', 'Gerente:GerEx']);
});

// A RPC corta inativos da cadeia, então o primeiro da lista pode ser um avô —
// e é ele quem responde pela pessoa hoje.
test('coordenador inativo some da cadeia e o gerente vira o gestor direto', () => {
  assert.deepEqual(escada([
    { nivel: 2, id: 'g', nome: 'GerEx', funcao: 'GERENTE EXECUTIVO' },
    { nivel: 3, id: 'd', nome: 'Diretor', funcao: 'DIRETOR DE OPERAÇÕES' },
  ]), ['Gestor direto:GerEx']);
});

test('acento e caixa do cadastro não mudam a classificação do cargo', () => {
  assert.equal(ehAcimaDeGerente('Diretor Comercial'), true);
  assert.equal(ehAcimaDeGerente('DIRETOR DE OPERAÇÕES'), true);
  assert.equal(ehGerente('  gerente de pmo  '), true);
  assert.equal(ehGerencia('COORDENADORA DE MARKETING '), false);
  assert.equal(ehGerencia('ESPECIALISTA DE PMO'), false);
});

// ---------------------------------------------------------------------------
// Centro de custo pelo organograma
// ---------------------------------------------------------------------------

const EQUIPES = ['Equipe IVANO ROBERTO SILVA DA CRUZ', 'Equipe LEONARDO AUGUSTO OLIVEIRA DRUMOND',
  'Equipe TULIO RAFAEL DE MORAIS NEIVA', 'Gerência Geral'];
const ALESSANDRO = { nivel: 1, id: 'a', nome: 'ALESSANDRO PEREIRA MOREIRA', funcao: 'COORDENADOR DE PLANEJAMENTOS' };
const IVANO = { nivel: 2, id: 'i', nome: 'IVANO ROBERTO SILVA DA CRUZ', funcao: 'HEAD DE QUALIDADE' };
const LEONARDO = { nivel: 3, id: 'l', nome: 'LEONARDO AUGUSTO OLIVEIRA DRUMOND', funcao: 'GERENTE EXECUTIVO' };

// Chamado #376: o Adailton estava em "Equipe PAULO" no Gestão de Horas.
test('CC é a equipe do gerente da escada, não a do coordenador', () => {
  assert.equal(equipeDoOrganograma([ALESSANDRO, IVANO, LEONARDO], EQUIPES),
    'Equipe IVANO ROBERTO SILVA DA CRUZ');
});

test('coordenador com equipe própria não puxa o CC: vale a do gerente', () => {
  const tulio = { nivel: 1, id: 't', nome: 'TULIO RAFAEL DE MORAIS NEIVA', funcao: 'COORDENADOR DE PLANEJAMENTO' };
  assert.equal(equipeDoOrganograma([tulio, { ...LEONARDO, nivel: 2 }], EQUIPES),
    'Equipe LEONARDO AUGUSTO OLIVEIRA DRUMOND');
});

test('gerente sem equipe própria: sobe até o primeiro que lidera uma', () => {
  const semEquipe = { nivel: 2, id: 'g', nome: 'FULANO', funcao: 'GERENTE DE PMO' };
  assert.equal(equipeDoOrganograma([ALESSANDRO, semEquipe, LEONARDO], EQUIPES),
    'Equipe LEONARDO AUGUSTO OLIVEIRA DRUMOND');
});

test('sem cadeia ou sem equipe na cadeia, devolve vazio', () => {
  assert.equal(equipeDoOrganograma([], EQUIPES), '');
  assert.equal(equipeDoOrganograma([{ nivel: 1, id: 'x', nome: 'X', funcao: 'CEO' }], EQUIPES), '');
});
