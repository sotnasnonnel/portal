import test from 'node:test';
import assert from 'node:assert/strict';
import {
  conferirSaldos, variantesSemSaldo, linhaSemSaldo, validarCarrinho, montarMovimentos,
  movimentosDeInventario, totalizar, linhaVazia, saldoDaCondicao,
} from './carrinho.js';

// Saldo por condição: peça nova e peça usada têm bolsos próprios, como na
// planilha (colunas USADO e NOVO) e no banco (saldo_novo / saldo_usado).
const CAPACETE = {
  id: 'v1', descricao: 'CAPACETE 3M', ca: '29638',
  saldo_novo: 1, saldo_usado: 3, saldo: 4, custo_unitario: 40,
};
const BOTINA = {
  id: 'v2', descricao: 'BOTINA', tamanho: '42',
  saldo_novo: 5, saldo_usado: 0, saldo: 5, custo_unitario: 100,
};

const linha = (p) => ({ ...linhaVazia(), ...p });

test('montarMovimentos inverte o sinal só na saída', () => {
  const l = [linha({ variante_id: 'v1', quantidade: 3, colaborador_id: 'c1', variante: CAPACETE })];
  assert.equal(montarMovimentos(l, { tipo: 'saida' })[0].quantidade, -3);
  assert.equal(montarMovimentos(l, { tipo: 'entrada' })[0].quantidade, 3);
});

test('montarMovimentos descarta linha sem item ou com quantidade inválida', () => {
  const l = [
    linha({ variante_id: '', quantidade: 2 }),
    linha({ variante_id: 'v1', quantidade: 0 }),
    linha({ variante_id: 'v2', quantidade: 1.5 }),
    linha({ variante_id: 'v2', quantidade: 2 }),
  ];
  assert.equal(montarMovimentos(l, { tipo: 'entrada' }).length, 1);
});

test('montarMovimentos usa o motivo da linha e cai no motivo do lote', () => {
  const l = [
    linha({ variante_id: 'v1', quantidade: 1, motivo: 'Perda ou extravio' }),
    linha({ variante_id: 'v2', quantidade: 1 }),
  ];
  const movs = montarMovimentos(l, { tipo: 'entrada', motivo: 'Compra', documento: ' NF 123 ' });
  assert.equal(movs[0].motivo, 'Perda ou extravio');
  assert.equal(movs[1].motivo, 'Compra');
  assert.equal(movs[1].documento, 'NF 123');
});

// O caso que justifica somar por variante em vez de validar linha a linha.
test('saldoDaCondicao le o bolso certo', () => {
  assert.equal(saldoDaCondicao(CAPACETE, 'novo'), 1);
  assert.equal(saldoDaCondicao(CAPACETE, 'usado'), 3);
  assert.equal(saldoDaCondicao(undefined, 'novo'), 0);
});

test('conferirSaldos soma o lote inteiro: duas linhas de 1 não cabem em saldo 1', () => {
  const l = [
    linha({ variante_id: 'v1', quantidade: 1, colaborador_id: 'c1', variante: CAPACETE }),
    linha({ variante_id: 'v1', quantidade: 1, colaborador_id: 'c2', variante: CAPACETE }),
  ];
  const [c] = conferirSaldos(l);
  assert.equal(c.pedido, 2);
  assert.equal(c.saldo, 1);          // só o bolso "novo"
  assert.equal(c.falta, 1);
  assert.deepEqual([...variantesSemSaldo(l)], ['v1|novo']);
  assert.equal(linhaSemSaldo(l[0], variantesSemSaldo(l)), true);
  assert.match(validarCarrinho(l, { tipo: 'saida' }), /Saldo insuficiente de CAPACETE 3M.*\(novo\)/);
});

// O caso que a conferência só do total erraria: 1 novo + 3 usados cabe num item
// que tem 1 de cada tipo... não, tem 1 novo e 3 usados. Somar daria 4 = 4 e
// passaria; separado, cada bolso é conferido contra o seu.
test('conferirSaldos separa os bolsos: novo e usado não se cobrem', () => {
  const cabe = [
    linha({ variante_id: 'v1', quantidade: 1, condicao: 'novo', colaborador_id: 'c1', variante: CAPACETE }),
    linha({ variante_id: 'v1', quantidade: 3, condicao: 'usado', colaborador_id: 'c2', variante: CAPACETE }),
  ];
  assert.equal(validarCarrinho(cabe, { tipo: 'saida' }), '', 'usa o que existe em cada bolso');

  // Mesmo total (4), mas todo ele do bolso "novo", que só tem 1.
  const naoCabe = [
    linha({ variante_id: 'v1', quantidade: 4, condicao: 'novo', colaborador_id: 'c1', variante: CAPACETE }),
  ];
  assert.match(validarCarrinho(naoCabe, { tipo: 'saida' }), /disponível 1, pedido 4/);
});

test('conferirSaldos não acusa falta quando o lote cabe', () => {
  const l = [
    linha({ variante_id: 'v2', quantidade: 2, colaborador_id: 'c1', variante: BOTINA }),
    linha({ variante_id: 'v2', quantidade: 3, colaborador_id: 'c2', variante: BOTINA }),
  ];
  assert.equal(conferirSaldos(l)[0].falta, 0);
  assert.equal(variantesSemSaldo(l).size, 0);
  assert.equal(validarCarrinho(l, { tipo: 'saida' }), '');
});

test('montarMovimentos carrega a condicao, com novo como padrao', () => {
  const l = [
    linha({ variante_id: 'v1', quantidade: 1, condicao: 'usado', colaborador_id: 'c1', variante: CAPACETE }),
    linha({ variante_id: 'v2', quantidade: 1, colaborador_id: 'c1', variante: BOTINA }),
  ];
  const movs = montarMovimentos(l, { tipo: 'saida' });
  assert.equal(movs[0].condicao, 'usado');
  assert.equal(movs[1].condicao, 'novo');
});

test('validarCarrinho exige quem recebeu na saída (espelha a constraint do banco)', () => {
  const l = [linha({ variante_id: 'v2', quantidade: 1, variante: BOTINA })];
  assert.match(validarCarrinho(l, { tipo: 'saida' }), /Informe quem recebeu BOTINA · 42/);
  // Entrada não pede pessoa.
  assert.equal(validarCarrinho(l, { tipo: 'entrada' }), '');
});

test('validarCarrinho recusa carrinho vazio e quantidade não inteira', () => {
  assert.match(validarCarrinho([], { tipo: 'entrada' }), /ao menos um item/);
  assert.match(validarCarrinho([linha({})], { tipo: 'entrada' }), /ao menos um item/);
  assert.match(
    validarCarrinho([linha({ variante_id: 'v2', quantidade: 2.5, variante: BOTINA })], { tipo: 'entrada' }),
    /quantidade inteira maior que zero/,
  );
});

test('validarCarrinho não checa saldo na entrada nem no ajuste', () => {
  const l = [linha({ variante_id: 'v1', quantidade: 999, variante: CAPACETE })];
  assert.equal(validarCarrinho(l, { tipo: 'entrada' }), '');
  assert.equal(validarCarrinho(l, { tipo: 'ajuste' }), '');
});

// O inventário conta CADA BOLSO: quem conferiu 4 peças novas não disse nada
// sobre as usadas, e o ajuste não pode inventar isso.
test('movimentosDeInventario transforma contagem em delta, por condição', () => {
  const l = [
    { variante_id: 'v1', condicao: 'novo', contagem: 4, variante: CAPACETE },   // 4 - 1 = +3
    { variante_id: 'v1', condicao: 'usado', contagem: 3, variante: CAPACETE },  // confere: nada
    { variante_id: 'v2', contagem: 5, variante: BOTINA },                        // confere: nada
    { variante_id: 'v3', contagem: 0, variante: { saldo_novo: 2 } },             // 0 - 2 = -2
  ];
  const movs = movimentosDeInventario(l);
  assert.equal(movs.length, 2);
  assert.equal(movs[0].quantidade, 3);
  assert.equal(movs[0].condicao, 'novo');
  assert.equal(movs[1].quantidade, -2);
  assert.equal(movs[0].tipo, 'ajuste');
  assert.match(movs[0].observacao, /Contagem 4, sistema 1 \(novo\)/);
});

test('movimentosDeInventario ignora linha não contada', () => {
  const l = [
    { variante_id: 'v1', contagem: '', variante: CAPACETE },
    { variante_id: 'v2', contagem: null, variante: BOTINA },
    { variante_id: 'v3', contagem: undefined, variante: BOTINA },
    { variante_id: 'v4', contagem: -1, variante: BOTINA },
  ];
  assert.deepEqual(movimentosDeInventario(l), []);
});

test('totalizar conta linhas, peças e valor', () => {
  const l = [
    linha({ variante_id: 'v1', quantidade: 2, variante: CAPACETE }),
    linha({ variante_id: 'v2', quantidade: 3, variante: BOTINA }),
    linha({ variante_id: '', quantidade: 9 }),
  ];
  assert.deepEqual(totalizar(l), { linhas: 2, pecas: 5, valor: 2 * 40 + 3 * 100 });
});

test('totalizar trata custo ausente como zero em vez de NaN', () => {
  const l = [linha({ variante_id: 'v1', quantidade: 2, variante: { saldo: 9 } })];
  assert.equal(totalizar(l).valor, 0);
});
