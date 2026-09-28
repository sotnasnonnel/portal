import test from 'node:test';
import assert from 'node:assert/strict';
import { numeroExtenso, valorExtenso, valorComExtenso, numeroComExtenso, dataExtenso } from './formato.js';

// fmtBRL separa "R$" do número com espaço não separável; nas comparações abaixo
// ele vira espaço comum para o texto esperado ficar legível.
const semNbsp = (s) => String(s).replace(/\u00a0/g, ' ');

// Os três valores abaixo saíram do distrato assinado (Bigti, 09/09/2026): é a
// redação que o instrumento precisa reproduzir letra por letra.
test('valores do distrato assinado', () => {
  assert.equal(valorExtenso(16560.05), 'dezesseis mil, quinhentos e sessenta reais e cinco centavos');
  assert.equal(valorExtenso(13226.72), 'treze mil, duzentos e vinte e seis reais e setenta e dois centavos');
  assert.equal(valorExtenso(3333.33), 'três mil, trezentos e trinta e três reais e trinta e três centavos');
});

test('reais e centavos no singular, e o zero', () => {
  assert.equal(valorExtenso(1), 'um real');
  assert.equal(valorExtenso(0.01), 'um centavo');
  assert.equal(valorExtenso(1.01), 'um real e um centavo');
  assert.equal(valorExtenso(0), 'zero reais');
  assert.equal(valorExtenso(null), 'zero reais');
  assert.equal(valorExtenso(100), 'cem reais');
});

test('centavos arredondam em vez de truncar', () => {
  assert.equal(valorExtenso(0.005), 'um centavo');
  assert.equal(valorExtenso(1.999), 'dois reais');
});

test('último grupo entra com "e" ou com vírgula', () => {
  assert.equal(numeroExtenso(1500), 'mil e quinhentos');
  assert.equal(numeroExtenso(1050), 'mil e cinquenta');
  assert.equal(numeroExtenso(16560), 'dezesseis mil, quinhentos e sessenta');
  assert.equal(numeroExtenso(1000), 'mil');
  assert.equal(numeroExtenso(2000), 'dois mil');
});

test('centenas, dezenas e escalas', () => {
  assert.equal(numeroExtenso(0), 'zero');
  assert.equal(numeroExtenso(16), 'dezesseis');
  assert.equal(numeroExtenso(33), 'trinta e três');
  assert.equal(numeroExtenso(100), 'cem');
  assert.equal(numeroExtenso(101), 'cento e um');
  assert.equal(numeroExtenso(999), 'novecentos e noventa e nove');
  assert.equal(numeroExtenso(1000000), 'um milhão');
  assert.equal(numeroExtenso(2500000), 'dois milhões e quinhentos mil');
});

test('formatos prontos para o texto do instrumento', () => {
  assert.equal(
    semNbsp(valorComExtenso(16560.05)),
    'R$ 16.560,05 (dezesseis mil, quinhentos e sessenta reais e cinco centavos)',
  );
  assert.equal(numeroComExtenso(7), '7 (sete)');
  assert.equal(numeroComExtenso(2, 2), '02 (dois)');
});

test('data por extenso mantém o dia com dois dígitos', () => {
  assert.equal(dataExtenso('2026-01-02'), '02 de janeiro de 2026');
  assert.equal(dataExtenso('2026-09-01'), '01 de setembro de 2026');
  assert.equal(dataExtenso('2026-09-09'), '09 de setembro de 2026');
  assert.equal(dataExtenso('2026-12-31'), '31 de dezembro de 2026');
  assert.equal(dataExtenso(null), '—');
  assert.equal(dataExtenso('31/12/2026'), '—');
});
