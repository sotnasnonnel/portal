import test from 'node:test';
import assert from 'node:assert/strict';
import {
  conferirSaldos, variantesSemSaldo, validarCarrinho, montarMovimentos,
  movimentosDeInventario, totalizar, linhaVazia,
} from './carrinho.js';

const CAPACETE = { id: 'v1', descricao: 'CAPACETE 3M', ca: '29638', saldo: 1, custo_unitario: 40 };
const BOTINA = { id: 'v2', descricao: 'BOTINA', tamanho: '42', saldo: 5, custo_unitario: 100 };

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
test('conferirSaldos soma o lote inteiro: duas linhas de 1 não cabem em saldo 1', () => {
  const l = [
    linha({ variante_id: 'v1', quantidade: 1, colaborador_id: 'c1', variante: CAPACETE }),
    linha({ variante_id: 'v1', quantidade: 1, colaborador_id: 'c2', variante: CAPACETE }),
  ];
  const [c] = conferirSaldos(l);
  assert.equal(c.pedido, 2);
  assert.equal(c.saldo, 1);
  assert.equal(c.falta, 1);
  assert.deepEqual([...variantesSemSaldo(l)], ['v1']);
  assert.match(validarCarrinho(l, { tipo: 'saida' }), /Saldo insuficiente de CAPACETE 3M/);
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

test('movimentosDeInventario transforma contagem em delta e ignora o que confere', () => {
  const l = [
    { variante_id: 'v1', contagem: 4, variante: CAPACETE },  // 4 - 1 = +3
    { variante_id: 'v2', contagem: 5, variante: BOTINA },    // confere: nada
    { variante_id: 'v3', contagem: 0, variante: { saldo: 2 } }, // 0 - 2 = -2
  ];
  const movs = movimentosDeInventario(l);
  assert.equal(movs.length, 2);
  assert.equal(movs[0].quantidade, 3);
  assert.equal(movs[1].quantidade, -2);
  assert.equal(movs[0].tipo, 'ajuste');
  assert.match(movs[0].observacao, /Contagem 4, sistema 1/);
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
