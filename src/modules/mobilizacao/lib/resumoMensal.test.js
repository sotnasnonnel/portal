import test from 'node:test';
import assert from 'node:assert/strict';
import { resumoDoMes, mesesComDados, evolucaoMensal, rotuloMes } from './resumoMensal.js';

const p = (extra) => ({ status: 'finalizado', fluxo: 'mobilizacao_pessoa', ...extra });

// 01/09/2026 é terça. Dias úteis contando as duas pontas.
const lista = [
  p({ id: 'a', data_base: '2026-09-01', concluido_real: '2026-09-15' }), // 11
  p({ id: 'b', data_base: '2026-09-01', concluido_real: '2026-09-04' }), // 4
  p({ id: 'c', data_base: '2026-08-20', concluido_real: '2026-08-21' }), // agosto
  p({ id: 'd', fluxo: 'mobilizacao_empresa', data_base: '2026-09-07', concluido_real: '2026-09-11' }), // 5
  p({ id: 'e', status: 'cancelado', data_base: '2026-09-01', concluido_real: null }),
  p({ id: 'f', fluxo: 'desmobilizacao_pessoa', data_base: '2026-09-01', concluido_real: '2026-09-02' }),
];

test('o mês é o da conclusão, e só entram as finalizadas', () => {
  const r = resumoDoMes(lista, 'mobilizacao_pessoa', '2026-09');
  assert.equal(r.quantidade, 2);
  assert.deepEqual(r.itens.map((i) => [i.id, i.dias]), [['a', 11], ['b', 4]], 'a mais longa primeiro');
  assert.equal(r.media, 8, '(11 + 4) / 2 = 7,5 → 8, arredondado para cima como nos indicadores');
});

test('pessoas e empresas ficam separadas; desmobilização não entra', () => {
  assert.equal(resumoDoMes(lista, 'mobilizacao_empresa', '2026-09').quantidade, 1);
  assert.deepEqual(mesesComDados(lista), ['2026-09', '2026-08']);
});

test('a evolução traz os dois grupos em todo mês, mesmo com zero', () => {
  const agosto = evolucaoMensal(lista).find((m) => m.mes === '2026-08');
  assert.deepEqual(agosto.grupos, [
    { fluxo: 'mobilizacao_pessoa', quantidade: 1, media: 2 },
    { fluxo: 'mobilizacao_empresa', quantidade: 0, media: null },
  ]);
  assert.equal(rotuloMes('2026-09'), 'setembro de 2026');
});
