import { test } from "node:test";
import assert from "node:assert";
import { itensDaPlanilha, dataDaCelula, valorDaCelula, colunasDoModelo } from "./planilhaItens.js";

test("modelo preenchido vira itens, com data em série do Excel", () => {
  const { itens, ignoradas } = itensDaPlanilha([
    colunasDoModelo(true),
    [1, "almoço", 46300, 45.5, "123", "Restaurante X", ""],
    [2, "Uber", 46301, "R$ 1.234,56", "", "", "ida à obra"],
  ]);
  assert.equal(ignoradas, 0);
  assert.equal(itens.length, 2);
  assert.equal(itens[0].description, "ALMOÇO");
  assert.equal(itens[0].item_date, "2026-10-05");
  assert.equal(itens[0].value, "45.5");
  assert.equal(itens[0].nf_number, "123");
  assert.equal(itens[1].qty, 2);
  assert.equal(itens[1].value, "1234.56");
  assert.equal(itens[1].notes, "ida à obra");
  assert.deepEqual(itens.map((i) => i.sort_order), [0, 1]);
});

test("acha o cabeçalho abaixo de um título e em outra ordem", () => {
  const { itens } = itensDaPlanilha([
    ["Despesas de viagem"],
    [],
    ["Data", "Descrição", "Valor"],
    ["05/10/2026", "janta", 60],
  ]);
  assert.equal(itens.length, 1);
  assert.equal(itens[0].description, "JANTA");
  assert.equal(itens[0].item_date, "2026-10-05");
  assert.equal(itens[0].value, "60");
  assert.equal(itens[0].qty, 1);
});

test("linha de total e linha sem descrição ficam de fora", () => {
  const { itens, ignoradas } = itensDaPlanilha([
    ["Item", "Valor"],
    ["café", 10],
    ["", 10],
    ["TOTAL", 20],
  ]);
  assert.equal(itens.length, 1);
  assert.equal(ignoradas, 2);
});

test("sem NF (adiantamento) não lê data, NF nem local", () => {
  const { itens } = itensDaPlanilha([colunasDoModelo(false), [1, "hospedagem", 300, "2 noites"]], { allowNf: false });
  assert.equal(itens[0].value, "300");
  assert.equal(itens[0].notes, "2 noites");
  assert.equal(itens[0].nf_number, "");
});

test("dataDaCelula e valorDaCelula", () => {
  assert.equal(dataDaCelula("5/1/26"), "2026-01-05");
  assert.equal(dataDaCelula("2026-10-05"), "2026-10-05");
  assert.equal(dataDaCelula("amanhã"), null);
  assert.equal(valorDaCelula("12,30"), 12.3);
  assert.equal(valorDaCelula("12.30"), 12.3);
  assert.equal(valorDaCelula(""), null);
});
