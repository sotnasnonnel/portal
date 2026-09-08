import test from 'node:test';
import assert from 'node:assert/strict';
import {
  corDaCelula, tituloCurto, colunasDoFluxo, montarMatriz, resumoDaColuna, linhaEmAndamento,
} from './matriz.js';

const FLUXOS = [
  { slug: 'mobilizacao_pessoa', label: 'Mobilização de pessoas' },
  { slug: 'mobilizacao_empresa', label: 'Mobilização da empresa' },
];

const cat = (fluxo, codigo, ordem, titulo = codigo, over = {}) =>
  ({ fluxo, codigo, ordem, titulo, ativo: true, ...over });

const CATALOGO = [
  cat('mobilizacao_pessoa', 'abertura', 1, 'Abertura de chamado'),
  cat('mobilizacao_pessoa', 'exames', 2, 'Exames'),
  cat('mobilizacao_pessoa', 'aso', 3, 'Emissão do ASO'),
  cat('mobilizacao_empresa', 'anexo', 1, 'Envio do Anexo 06'),
];

const etapa = (processo_id, codigo, over = {}) =>
  ({ processo_id, codigo, status: 'pendente', dias_atraso: null, ...over });

// ---------------------------------------------------------------------------
// A cor
// ---------------------------------------------------------------------------

test('a régua de cores é a do semáforo do quadro', () => {
  assert.equal(corDaCelula({ status: 'concluida', dias_atraso: 9 }), 'concluida',
    'concluída é verde mesmo tendo atrasado — o atraso já entra no indicador de prazo');
  assert.equal(corDaCelula({ status: 'pendente', dias_atraso: 3 }), 'vencida');
  assert.equal(corDaCelula({ status: 'em_andamento', dias_atraso: 1 }), 'vencida');
  assert.equal(corDaCelula({ status: 'pendente', dias_atraso: 0 }), 'no-prazo',
    'vence hoje ainda não venceu');
  assert.equal(corDaCelula({ status: 'pendente', dias_atraso: -5 }), 'no-prazo');
  assert.equal(corDaCelula({ status: 'dispensada' }), 'dispensada');
});

// Pintar de amarelo esconderia justamente o processo que ninguém consegue
// acompanhar — o que nasceu sem data-base.
test('em aberto e sem prazo tem cor própria', () => {
  assert.equal(corDaCelula({ status: 'pendente', dias_atraso: null }), 'sem-prazo');
});

test('etapa que não existe no processo é buraco, não erro', () => {
  assert.equal(corDaCelula(null), 'ausente');
  assert.equal(corDaCelula(undefined), 'ausente');
});

// ---------------------------------------------------------------------------
// Cabeçalho
// ---------------------------------------------------------------------------

test('o título curto corta por palavra, nunca no meio', () => {
  assert.equal(tituloCurto('Exames'), 'Exames');
  assert.equal(tituloCurto('Aprovação do cliente final', 12), 'Aprovação do');
  assert.equal(tituloCurto('Conclusão dos treinamentos', 12), 'Conclusão');
  assert.equal(tituloCurto('', 12), '');
});

test('palavra única maior que o limite não some', () => {
  assert.equal(tituloCurto('Superextraordinariamente', 10), 'Superextra');
});

// ---------------------------------------------------------------------------
// As colunas
// ---------------------------------------------------------------------------

test('as colunas vêm do catálogo, em ordem', () => {
  const cols = colunasDoFluxo(CATALOGO, 'mobilizacao_pessoa');
  assert.deepEqual(cols.map((c) => c.codigo), ['abertura', 'exames', 'aso']);
  assert.equal(cols[2].titulo, 'Emissão do ASO');
});

test('etapa desativada sai das colunas', () => {
  const cols = colunasDoFluxo([...CATALOGO, cat('mobilizacao_pessoa', 'velha', 9, 'Velha', { ativo: false })],
    'mobilizacao_pessoa');
  assert.ok(!cols.some((c) => c.codigo === 'velha'));
});

// ---------------------------------------------------------------------------
// A matriz
// ---------------------------------------------------------------------------

const PROCESSOS = [
  { id: 'p1', numero: 1, titulo: 'ANA', fluxo: 'mobilizacao_pessoa' },
  { id: 'p2', numero: 2, titulo: 'BRUNO', fluxo: 'mobilizacao_pessoa' },
  { id: 'p3', numero: 3, titulo: 'IMC SASTE', fluxo: 'mobilizacao_empresa' },
];

test('um bloco por fluxo, na ordem dada', () => {
  const m = montarMatriz(PROCESSOS, [], CATALOGO, FLUXOS);
  assert.deepEqual(m.map((b) => b.fluxo), ['mobilizacao_pessoa', 'mobilizacao_empresa']);
  assert.equal(m[0].linhas.length, 2);
  assert.equal(m[1].linhas.length, 1);
});

// Três cabeçalhos vazios empilhados só empurram para baixo o que interessa.
test('fluxo sem processo não vira bloco vazio', () => {
  const m = montarMatriz(PROCESSOS.filter((p) => p.fluxo === 'mobilizacao_empresa'), [], CATALOGO, FLUXOS);
  assert.equal(m.length, 1);
  assert.equal(m[0].fluxo, 'mobilizacao_empresa');
});

// É a única razão de a matriz existir: comparar linhas na vertical.
test('a etapa que não nasceu vira buraco na coluna certa, sem deslocar as outras', () => {
  const etapas = [
    etapa('p1', 'abertura', { status: 'concluida' }),
    // p1 não tem "exames"
    etapa('p1', 'aso', { dias_atraso: 4 }),
  ];
  const [bloco] = montarMatriz([PROCESSOS[0]], etapas, CATALOGO, FLUXOS);
  const cores = bloco.linhas[0].celulas.map((c) => c.cor);

  assert.deepEqual(bloco.linhas[0].celulas.map((c) => c.codigo), ['abertura', 'exames', 'aso']);
  assert.deepEqual(cores, ['concluida', 'ausente', 'vencida']);
});

test('conta o que falta e o que venceu por linha', () => {
  const etapas = [
    etapa('p1', 'abertura', { status: 'concluida' }),
    etapa('p1', 'exames', { dias_atraso: 3 }),
    etapa('p1', 'aso', { status: 'dispensada' }),
  ];
  const [bloco] = montarMatriz([PROCESSOS[0]], etapas, CATALOGO, FLUXOS);
  assert.equal(bloco.linhas[0].vencidas, 1);
  assert.equal(bloco.linhas[0].faltam, 1, 'dispensada não conta como pendente');
});

// A ordem em que a reunião ataca a lista.
test('mais vencidas primeiro; empatando, quem tem mais a fazer', () => {
  const etapas = [
    // ANA: 1 vencida
    etapa('p1', 'abertura', { dias_atraso: 2 }),
    etapa('p1', 'exames', { status: 'concluida' }),
    etapa('p1', 'aso', { status: 'concluida' }),
    // BRUNO: 2 vencidas
    etapa('p2', 'abertura', { dias_atraso: 5 }),
    etapa('p2', 'exames', { dias_atraso: 1 }),
    etapa('p2', 'aso', { status: 'concluida' }),
  ];
  const [bloco] = montarMatriz(PROCESSOS, etapas, CATALOGO, FLUXOS);
  assert.deepEqual(bloco.linhas.map((l) => l.processo.titulo), ['BRUNO', 'ANA']);
});

test('sem vencidas nem pendências, desempata pelo nome', () => {
  const etapas = ['abertura', 'exames', 'aso'].flatMap((c) => [
    etapa('p1', c, { status: 'concluida' }),
    etapa('p2', c, { status: 'concluida' }),
  ]);
  const [bloco] = montarMatriz(PROCESSOS, etapas, CATALOGO, FLUXOS);
  assert.deepEqual(bloco.linhas.map((l) => l.processo.titulo), ['ANA', 'BRUNO']);
});

// ---------------------------------------------------------------------------
// Rodapé da coluna
// ---------------------------------------------------------------------------

test('o resumo da coluna responde "este passo trava todo mundo?"', () => {
  const etapas = [
    etapa('p1', 'exames', { dias_atraso: 3 }),
    etapa('p2', 'exames', { dias_atraso: 8 }),
    etapa('p1', 'abertura', { status: 'concluida' }),
    etapa('p2', 'abertura', { status: 'concluida' }),
  ];
  const [bloco] = montarMatriz(PROCESSOS, etapas, CATALOGO, FLUXOS);

  assert.equal(resumoDaColuna(bloco.linhas, 0).concluida, 2, 'abertura: todos concluíram');
  assert.equal(resumoDaColuna(bloco.linhas, 1).vencida, 2, 'exames: trava os dois');
});

test('coluna fora do intervalo não quebra o resumo', () => {
  const [bloco] = montarMatriz([PROCESSOS[0]], [], CATALOGO, FLUXOS);
  assert.deepEqual(resumoDaColuna(bloco.linhas, 99).ausente, 0);
});

test('linha concluída sai do filtro de em andamento', () => {
  const etapas = ['abertura', 'exames', 'aso'].map((c) => etapa('p1', c, { status: 'concluida' }));
  const [bloco] = montarMatriz([PROCESSOS[0]], etapas, CATALOGO, FLUXOS);
  assert.equal(linhaEmAndamento(bloco.linhas[0]), false);
});

test('matriz vazia não quebra nada', () => {
  assert.deepEqual(montarMatriz([], [], [], FLUXOS), []);
  assert.deepEqual(montarMatriz([], [], [], []), []);
});
