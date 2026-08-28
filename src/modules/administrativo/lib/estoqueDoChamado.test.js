import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chamadoUsaEstoque, categoriaDoChamado, jaEntreguePorVariante, montarLinhasDeBaixa,
  linhasComQuantidade, validarLinhasDeBaixa, movimentosDaBaixa,
} from './estoqueDoChamado.js';

const CAPACETE = { id: 'v1', descricao: 'CAPACETE 3M', ca: '29638', saldo: 5 };
const BOTINA = { id: 'v2', descricao: 'BOTINA', tamanho: '42', saldo: 1 };
const POSICAO = [CAPACETE, BOTINA];

// `vitrine: false` = módulo ligado. Explícito para o teste não depender do
// valor atual de ESTOQUE_VITRINE.
const LIGADO = { vitrine: false };

test('chamadoUsaEstoque só vale para EPI e uniforme', () => {
  assert.equal(chamadoUsaEstoque({ classe: 'saude-seguranca', servico: 'epi' }, LIGADO), true);
  assert.equal(chamadoUsaEstoque({ classe: 'saude-seguranca', servico: 'uniforme' }, LIGADO), true);
  // "Outras demandas" mora na mesma classe, mas não tem item de estoque.
  assert.equal(chamadoUsaEstoque({ classe: 'saude-seguranca', servico: 'outras-demandas' }, LIGADO), false);
  assert.equal(chamadoUsaEstoque({ classe: 'frota', servico: 'reserva-veiculos' }, LIGADO), false);
  assert.equal(chamadoUsaEstoque(null, LIGADO), false);
  assert.equal(chamadoUsaEstoque(undefined, LIGADO), false);
});

// O interruptor: em vitrine a integração inteira com o Adm some de uma vez —
// card de baixa, consulta de saldo e coluna "Em estoque" dependem todos daqui.
test('modo vitrine desliga a integração para todos os serviços', () => {
  const V = { vitrine: true };
  assert.equal(chamadoUsaEstoque({ classe: 'saude-seguranca', servico: 'epi' }, V), false);
  assert.equal(chamadoUsaEstoque({ classe: 'saude-seguranca', servico: 'uniforme' }, V), false);
});

test('categoriaDoChamado mapeia o serviço para a categoria do catálogo', () => {
  assert.equal(categoriaDoChamado({ servico: 'uniforme' }), 'uniforme');
  assert.equal(categoriaDoChamado({ servico: 'epi' }), 'epi');
});

test('jaEntreguePorVariante soma só as saídas, em módulo', () => {
  const m = jaEntreguePorVariante([
    { variante_id: 'v1', tipo: 'saida', quantidade: -2 },
    { variante_id: 'v1', tipo: 'saida', quantidade: -1 },
    { variante_id: 'v1', tipo: 'entrada', quantidade: 10 },
    { variante_id: 'v2', tipo: 'ajuste', quantidade: -3 },
  ]);
  assert.equal(m.get('v1'), 3);
  assert.equal(m.get('v2'), undefined);
});

// O caso normal: todo chamado aberto até hoje, e todo filho de mobilização.
test('chamado legado sem campos.itens abre o card vazio, sem quebrar', () => {
  assert.deepEqual(montarLinhasDeBaixa({ campos: { tipo: ['Capacete'], tipo_livre: '2 polos M' }, posicao: POSICAO }), []);
  assert.deepEqual(montarLinhasDeBaixa({}), []);
  assert.deepEqual(montarLinhasDeBaixa({ campos: { itens: 'não é array' } }), []);
});

test('montarLinhasDeBaixa junta pedido, já entregue e saldo, e assume o solicitante', () => {
  const linhas = montarLinhasDeBaixa({
    campos: { itens: [
      { variante_id: 'v1', descricao: 'CAPACETE 3M', ca: '29638', quantidade: 3 },
      { variante_id: 'v2', descricao: 'BOTINA', tamanho: '42', quantidade: 1 },
    ] },
    movimentos: [{ variante_id: 'v1', tipo: 'saida', quantidade: -1 }],
    posicao: POSICAO,
    solicitanteId: 'c9',
  });

  assert.equal(linhas[0].pedido, 3);
  assert.equal(linhas[0].jaEntregue, 1);
  assert.equal(linhas[0].quantidade, 2);          // falta entregar
  assert.equal(linhas[0].variante.saldo, 5);
  assert.equal(linhas[0].colaborador_id, 'c9');
  assert.equal(linhas[1].quantidade, 1);
});

// Sem a coluna "já entregue", fechar de novo depois de uma reabertura baixaria
// o material duas vezes — e ele já está com a pessoa.
test('reabertura: item totalmente entregue vem com quantidade 0 e não vira movimento', () => {
  const linhas = montarLinhasDeBaixa({
    campos: { itens: [{ variante_id: 'v1', descricao: 'CAPACETE 3M', quantidade: 2 }] },
    movimentos: [{ variante_id: 'v1', tipo: 'saida', quantidade: -2 }],
    posicao: POSICAO,
  });
  assert.equal(linhas[0].quantidade, 0);
  assert.deepEqual(linhasComQuantidade(linhas), []);
  assert.deepEqual(movimentosDaBaixa(linhas), []);
  assert.equal(validarLinhasDeBaixa(linhas), '');
});

test('entrega a mais do que foi pedido não gera quantidade negativa', () => {
  const linhas = montarLinhasDeBaixa({
    campos: { itens: [{ variante_id: 'v1', quantidade: 1 }] },
    movimentos: [{ variante_id: 'v1', tipo: 'saida', quantidade: -5 }],
    posicao: POSICAO,
  });
  assert.equal(linhas[0].quantidade, 0);
});

test('item fora do catálogo sobrevive com o texto do pedido e é barrado na validação', () => {
  const linhas = montarLinhasDeBaixa({
    campos: { itens: [{ variante_id: 'sumiu', descricao: 'LUVA ANTIGA', tamanho: 'M', quantidade: 1 }] },
    posicao: POSICAO,
    solicitanteId: 'c9',
  });
  assert.equal(linhas[0].variante, null);
  assert.equal(linhas[0].descricaoPedida, 'LUVA ANTIGA');
  assert.equal(linhas[0].detalhePedido, 'M');
  assert.match(validarLinhasDeBaixa(linhas), /LUVA ANTIGA.*não está mais no catálogo/);
});

test('validarLinhasDeBaixa: carrinho vazio é permitido (fechar sem movimentar)', () => {
  assert.equal(validarLinhasDeBaixa([]), '');
  assert.equal(validarLinhasDeBaixa(null), '');
});

test('validarLinhasDeBaixa exige quem recebeu e respeita o saldo do lote', () => {
  const semQuem = [{ variante_id: 'v1', variante: CAPACETE, quantidade: 1, colaborador_id: '' }];
  assert.match(validarLinhasDeBaixa(semQuem), /Informe quem recebeu/);

  // Saldo da botina é 1; duas linhas de 1 para pessoas diferentes não cabem.
  const demais = [
    { variante_id: 'v2', variante: BOTINA, quantidade: 1, colaborador_id: 'a' },
    { variante_id: 'v2', variante: BOTINA, quantidade: 1, colaborador_id: 'b' },
  ];
  assert.match(validarLinhasDeBaixa(demais), /Saldo insuficiente de BOTINA · 42/);
});

test('movimentosDaBaixa entrega o formato da RPC, com sinal negativo', () => {
  const linhas = [
    { variante_id: 'v1', variante: CAPACETE, quantidade: 2, colaborador_id: 'c9' },
    { variante_id: 'v2', variante: BOTINA, quantidade: 0, colaborador_id: 'c9' },
  ];
  const movs = movimentosDaBaixa(linhas);
  assert.equal(movs.length, 1);
  assert.equal(movs[0].tipo, 'saida');
  assert.equal(movs[0].quantidade, -2);
  assert.equal(movs[0].colaborador_id, 'c9');
  assert.equal(movs[0].motivo, 'Entrega por chamado');
});
