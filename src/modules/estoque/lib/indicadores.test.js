import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mesDe, janelaDeMeses, resumoPosicao, consumoMensal,
  entradaSaidaMensal, topConsumidos, entregasPorColaborador, valorPorCategoria,
  listaPorSituacao,
} from './indicadores.js';

const REF = '2026-08-28T12:00:00Z';

const POSICAO = [
  { id: 'f', categoria: 'uniforme', descricao: 'Camisa Polo', tamanho: 'GG', saldo: 28, estoque_minimo: 2, estoque_maximo: 10, situacao: 'acima_maximo', valor_total: 0, custo_unitario: null, ativo: true },
  { id: 'a', categoria: 'epi', descricao: 'CAPACETE 3M', ca: '29638', saldo: 0, estoque_minimo: 2, situacao: 'sem_estoque', valor_total: 0, custo_unitario: 40, ativo: true },
  { id: 'b', categoria: 'epi', descricao: 'BOTINA', tamanho: '42', saldo: 3, estoque_minimo: 20, situacao: 'abaixo_minimo', valor_total: 300, custo_unitario: 100, ativo: true },
  { id: 'c', categoria: 'uniforme', descricao: 'Camisa Polo', tamanho: 'M', saldo: 28, estoque_minimo: 5, situacao: 'ok', valor_total: 1419.6, custo_unitario: 50.7, ativo: true },
  { id: 'd', categoria: 'epi', descricao: 'LUVA', saldo: 5, estoque_minimo: 0, situacao: 'ok', valor_total: 0, custo_unitario: null, ativo: true },
  { id: 'e', categoria: 'epi', descricao: 'ITEM MORTO', saldo: 9, estoque_minimo: 0, situacao: 'ok', valor_total: 0, custo_unitario: null, ativo: false },
];

const mov = (p) => ({
  tipo: 'saida', quantidade: -1, criado_em: REF, colaboradorNome: 'Paula',
  variante: { descricao: 'CAPACETE 3M', categoria: 'epi' }, ...p,
});

test('mesDe monta chave e rótulo sem depender do locale do runtime', () => {
  assert.deepEqual(mesDe('2026-08-28T12:00:00Z'), { chave: '2026-08', rotulo: 'ago/26' });
  assert.equal(mesDe('não é data'), null);
});

test('janelaDeMeses cobre N meses até a referência, do mais antigo ao mais novo', () => {
  const j = janelaDeMeses(REF, 3);
  assert.deepEqual(j.map((m) => m.rotulo), ['jun/26', 'jul/26', 'ago/26']);
});

test('janelaDeMeses atravessa a virada de ano', () => {
  assert.deepEqual(
    janelaDeMeses('2026-01-15T00:00:00Z', 3).map((m) => m.rotulo),
    ['nov/25', 'dez/25', 'jan/26'],
  );
});

test('resumoPosicao ignora inativos e conta o que falta custo', () => {
  const r = resumoPosicao(POSICAO);
  assert.equal(r.skus, 5);              // o inativo fica de fora
  assert.equal(r.semEstoque, 1);
  assert.equal(r.abaixoMinimo, 1);
  assert.equal(r.acimaMaximo, 1);
  assert.equal(r.emAlerta, 2);          // excesso NÃO é alerta de reposição
  assert.equal(r.semCusto, 2);
});

test('resumoPosicao quebra por categoria, separando nova de usada', () => {
  const p = [
    { categoria: 'epi', saldo_novo: 5, saldo_usado: 2, saldo: 7, situacao: 'ok', ativo: true },
    { categoria: 'epi', saldo_novo: 0, saldo_usado: 3, saldo: 3, situacao: 'ok', ativo: true },
    { categoria: 'uniforme', saldo_novo: 10, saldo_usado: 0, saldo: 10, situacao: 'ok', ativo: true },
    { categoria: 'epi', saldo_novo: 99, saldo_usado: 99, saldo: 198, situacao: 'ok', ativo: false },
  ];
  const [epi, uni] = resumoPosicao(p).porCategoria;
  assert.deepEqual(epi, { categoria: 'epi', variacoes: 2, novas: 5, usadas: 5, pecas: 10 });
  assert.deepEqual(uni, { categoria: 'uniforme', variacoes: 1, novas: 10, usadas: 0, pecas: 10 });
});

// Categoria sem nenhum item precisa aparecer zerada, não sumir do painel.
test('resumoPosicao devolve as duas categorias mesmo vazias', () => {
  const [epi, uni] = resumoPosicao([]).porCategoria;
  assert.equal(epi.pecas, 0);
  assert.equal(uni.pecas, 0);
});

test('listaPorSituacao devolve o que o indicador está contando', () => {
  assert.deepEqual(listaPorSituacao(POSICAO, 'sem_estoque').map((v) => v.id), ['a']);
  assert.deepEqual(listaPorSituacao(POSICAO, 'abaixo_minimo').map((v) => v.id), ['b']);
  assert.deepEqual(listaPorSituacao(POSICAO, 'acima_maximo').map((v) => v.id), ['f']);
  // Em 'ok' a ordem nao tem significado (todos com deficit 0); so o conteudo importa.
  assert.deepEqual(listaPorSituacao(POSICAO, 'ok').map((v) => v.id).sort(), ['c', 'd']);
  assert.deepEqual(listaPorSituacao(null, 'sem_estoque'), []);
});

test('listaPorSituacao calcula déficit e excesso, e ignora inativo', () => {
  const [botina] = listaPorSituacao(POSICAO, 'abaixo_minimo');
  assert.equal(botina.deficit, 17);     // mínimo 20 - saldo 3
  assert.equal(botina.excesso, 0);
  const [polo] = listaPorSituacao(POSICAO, 'acima_maximo');
  assert.equal(polo.excesso, 18);       // saldo 28 - máximo 10
  // O item inativo tem situação 'ok' e não aparece em lista nenhuma.
  assert.equal(listaPorSituacao(POSICAO, 'ok').some((v) => v.id === 'e'), false);
});

// Ordenar por nome faria a pessoa procurar o urgente no meio da lista.
test('listaPorSituacao ordena pelo que decide a ação', () => {
  const p = [
    { id: 'x', descricao: 'POUCO', saldo: 1, estoque_minimo: 2, situacao: 'abaixo_minimo', ativo: true },
    { id: 'y', descricao: 'MUITO', saldo: 1, estoque_minimo: 30, situacao: 'abaixo_minimo', ativo: true },
  ];
  assert.deepEqual(listaPorSituacao(p, 'abaixo_minimo').map((v) => v.id), ['y', 'x']);
});

// Zerado sem mínimo cadastrado precisa aparecer: é quando mais falta.
test('listaPorSituacao dá déficit 1 ao zerado sem mínimo', () => {
  const p = [{ id: 'z', descricao: 'MOCHILA', saldo: 0, estoque_minimo: 0, situacao: 'sem_estoque', ativo: true }];
  assert.equal(listaPorSituacao(p, 'sem_estoque')[0].deficit, 1);
});

test('consumoMensal separa por categoria e ignora entrada e ajuste', () => {
  const movs = [
    mov({ quantidade: -3 }),
    mov({ quantidade: -2, variante: { descricao: 'Camisa Polo', categoria: 'uniforme' } }),
    mov({ tipo: 'entrada', quantidade: 50 }),
    mov({ tipo: 'ajuste', quantidade: -9 }),
    mov({ quantidade: -4, criado_em: '2026-07-10T00:00:00Z' }),
  ];
  const serie = consumoMensal(movs, REF, 3);
  assert.deepEqual(serie.map((s) => s.name), ['jun/26', 'jul/26', 'ago/26']);
  assert.deepEqual(serie[2], { name: 'ago/26', epi: 3, uniforme: 2 });
  assert.equal(serie[1].epi, 4);
  assert.deepEqual(serie[0], { name: 'jun/26', epi: 0, uniforme: 0 });
});

test('consumoMensal descarta o que está fora da janela', () => {
  const serie = consumoMensal([mov({ criado_em: '2024-01-05T00:00:00Z', quantidade: -99 })], REF, 3);
  assert.equal(serie.reduce((s, m) => s + m.epi + m.uniforme, 0), 0);
});

test('entradaSaidaMensal usa módulo da quantidade e exclui ajuste', () => {
  const movs = [
    mov({ tipo: 'entrada', quantidade: 10 }),
    mov({ quantidade: -4 }),
    mov({ tipo: 'ajuste', quantidade: -7 }),
  ];
  const s = entradaSaidaMensal(movs, REF, 1);
  assert.deepEqual(s[0], { name: 'ago/26', entrada: 10, saida: 4 });
});

test('topConsumidos e entregasPorColaborador ranqueiam só as saídas', () => {
  const movs = [
    mov({ quantidade: -5 }),
    mov({ quantidade: -1, variante: { descricao: 'BOTINA', tamanho: '42', categoria: 'epi' } }),
    mov({ quantidade: -2, colaboradorNome: 'Bruno' }),
    mov({ tipo: 'entrada', quantidade: 100 }),
  ];
  const itens = topConsumidos(movs);
  assert.deepEqual(itens, [{ name: 'CAPACETE 3M', qtd: 7 }, { name: 'BOTINA · 42', qtd: 1 }]);
  const pessoas = entregasPorColaborador(movs);
  assert.deepEqual(pessoas, [{ name: 'Paula', qtd: 6 }, { name: 'Bruno', qtd: 2 }]);
});

test('entregasPorColaborador ignora saída sem nome resolvido', () => {
  assert.deepEqual(entregasPorColaborador([mov({ colaboradorNome: '' })]), []);
});

test('valorPorCategoria só conta quem tem custo e omite categoria zerada', () => {
  const v = valorPorCategoria(POSICAO);
  assert.deepEqual(v, [{ name: 'EPIs', valor: 300 }, { name: 'Uniformes', valor: 1419.6 }]);
  assert.deepEqual(valorPorCategoria([]), []);
});

test('as agregações aguentam lista vazia ou nula', () => {
  assert.equal(resumoPosicao(null).skus, 0);
  assert.deepEqual(topConsumidos(null), []);
  assert.equal(consumoMensal(null, REF, 2).length, 2);
});
