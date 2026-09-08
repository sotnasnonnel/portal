import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COLUNAS_CHAMADO, ehStatusAberto, corDaCelulaChamado, chaveServico,
  montarMatrizChamados, totalDaColuna, vencidosDaColuna,
} from './matrizChamados.js';

const AGORA = new Date('2026-09-08T12:00:00Z').getTime();
const emHoras = (h) => new Date(AGORA + h * 3600 * 1000).toISOString();

const ch = (extra = {}) => ({
  id: Math.random().toString(36).slice(2),
  classe: 'saude-seguranca',
  servico: 'uniforme',
  status: 'em_atendimento',
  sla_vence_em: emHoras(72),
  ...extra,
});

test('as colunas são só as situações em aberto, na ordem do trabalho', () => {
  assert.deepEqual(
    COLUNAS_CHAMADO.map((c) => c.status),
    ['aguardando_aprovacao', 'aberto', 'em_atendimento', 'aguardando_solicitante'],
  );
  // Encerrado fora: seria a maior coluna do mês e achataria as outras quatro.
  for (const s of ['fechado', 'reprovado', 'cancelado']) {
    assert.equal(ehStatusAberto(s), false, `${s} não pode virar coluna`);
  }
});

test('as colunas trazem o rótulo do Adm, e não um inventado aqui', () => {
  const aprov = COLUNAS_CHAMADO.find((c) => c.status === 'aguardando_aprovacao');
  assert.equal(aprov.label, 'Aguardando aprovação');
});

test('célula vazia é ausente, não verde', () => {
  assert.equal(corDaCelulaChamado([], 'aberto', AGORA), 'ausente');
});

// O ponto da matriz: ela é um alarme, não uma média.
test('um vencido no meio de vários em dia pinta a célula de vermelho', () => {
  const lista = [ch(), ch(), ch({ sla_vence_em: emHoras(-1) })];
  assert.equal(corDaCelulaChamado(lista, 'em_atendimento', AGORA), 'vencido');
});

test('em atendimento e dentro do prazo é verde', () => {
  assert.equal(corDaCelulaChamado([ch()], 'em_atendimento', AGORA), 'em-dia');
});

test('perto do vencimento é amarelo', () => {
  assert.equal(corDaCelulaChamado([ch({ sla_vence_em: emHoras(5) })], 'em_atendimento', AGORA), 'atencao');
});

// Regra pedida: a bola está com o solicitante. Nem verde (não está andando)
// nem vermelho (a espera não é do Adm).
test('aguardando solicitante é sempre amarelo, mesmo com prazo folgado', () => {
  const folgado = [ch({ status: 'aguardando_solicitante', sla_vence_em: emHoras(500) })];
  assert.equal(corDaCelulaChamado(folgado, 'aguardando_solicitante', AGORA), 'atencao');
});

// ...mas atraso continua ganhando de tudo, senão a coluna esconderia o vencido.
test('aguardando solicitante com atraso ainda é vermelho', () => {
  const atrasado = [ch({ status: 'aguardando_solicitante', sla_vence_em: emHoras(-10) })];
  assert.equal(corDaCelulaChamado(atrasado, 'aguardando_solicitante', AGORA), 'vencido');
});

// Aguardando aprovação nem ligou o relógio: verde inventaria uma folga.
test('sem prazo não é verde', () => {
  const semSla = [ch({ status: 'aguardando_aprovacao', sla_vence_em: null })];
  assert.equal(corDaCelulaChamado(semSla, 'aguardando_aprovacao', AGORA), 'sem-prazo');
});

test('linha traz o rótulo do catálogo, não o slug', () => {
  const [linha] = montarMatrizChamados([ch()], { agora: AGORA });
  assert.equal(linha.servico, 'Solicitação de uniforme');
  assert.equal(linha.classe, 'Saúde e segurança');
});

// Serviço que saiu do catálogo mas tem chamado vivo: aparece feio, mas aparece.
test('serviço fora do catálogo cai no slug em vez de sumir', () => {
  const orfao = ch({ classe: 'classe-extinta', servico: 'servico-extinto' });
  const [linha] = montarMatrizChamados([orfao], { agora: AGORA });
  assert.equal(linha.servico, 'servico-extinto');
  assert.equal(linha.chave, chaveServico('classe-extinta', 'servico-extinto'));
});

test('chamado encerrado não entra na matriz', () => {
  assert.deepEqual(montarMatrizChamados([ch({ status: 'fechado' })], { agora: AGORA }), []);
});

test('a linha com chamado vencido vai para o topo', () => {
  const linhas = montarMatrizChamados([
    ch({ classe: 'compra', servico: 'solicitacao-compra' }),
    ch({ classe: 'compra', servico: 'solicitacao-compra' }),
    ch({ classe: 'correio', servico: 'correio', sla_vence_em: emHoras(-4) }),
  ], { agora: AGORA });

  assert.equal(linhas[0].servico, 'Solicitação de correio', 'o vencido sobe mesmo tendo menos chamados');
  assert.equal(linhas[0].chamadosVencidos, 1);
  assert.equal(linhas[1].total, 2);
});

test('o chamado cai na coluna da própria situação', () => {
  const [linha] = montarMatrizChamados([
    ch({ status: 'aberto' }),
    ch({ status: 'aberto' }),
    ch({ status: 'aguardando_solicitante' }),
  ], { agora: AGORA });

  const porStatus = Object.fromEntries(linha.celulas.map((c) => [c.status, c.total]));
  assert.deepEqual(porStatus, {
    aguardando_aprovacao: 0, aberto: 2, em_atendimento: 0, aguardando_solicitante: 1,
  });
  assert.equal(linha.total, 3);
});

test('o rodapé soma a coluna inteira, e conta os vencidos dela', () => {
  const linhas = montarMatrizChamados([
    ch({ classe: 'compra', servico: 'solicitacao-compra', status: 'aberto', sla_vence_em: emHoras(-2) }),
    ch({ classe: 'correio', servico: 'correio', status: 'aberto', sla_vence_em: emHoras(-3) }),
    ch({ classe: 'correio', servico: 'correio', status: 'aberto' }),
  ], { agora: AGORA });

  const iAberto = COLUNAS_CHAMADO.findIndex((c) => c.status === 'aberto');
  assert.equal(totalDaColuna(linhas, iAberto), 3);
  assert.equal(vencidosDaColuna(linhas, iAberto, AGORA), 2);
});
