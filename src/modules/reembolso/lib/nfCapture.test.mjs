import { test } from "node:test";
import assert from "node:assert";
import { makeKey, newItem, itemsFromExtraction } from "./nfCapture.js";

test("makeKey gera chaves únicas", () => {
  assert.notEqual(makeKey(), makeKey());
});

test("newItem cria linha vazia com sort_order", () => {
  const it = newItem(3);
  assert.equal(it.sort_order, 3);
  assert.equal(it.qty, 1);
  assert.equal(it.description, "");
});

test("itemsFromExtraction sem itens detalhados gera 1 linha com a categoria", () => {
  const rows = itemsFromExtraction({ categoria: "almoço", valor_total: 45, numero_nota: "123" }, 0);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].description, "ALMOÇO");
  assert.equal(rows[0].value, "45");
  assert.equal(rows[0].nf_number, "123");
  assert.equal(rows[0].meal_category, "almoço");
});

test("itemsFromExtraction com itens gera uma linha por item, replicando dados da nota", () => {
  const rows = itemsFromExtraction(
    { categoria: "café da manhã", numero_nota: "9", local: "PADARIA", itens: [
      { descricao: "cafe", valor: 5 }, { descricao: "pao", valor: 3 } ] },
    2
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].description, "CAFE");
  assert.equal(rows[0].sort_order, 2);
  assert.equal(rows[1].sort_order, 3);
  assert.equal(rows[1].nf_number, "9");
  assert.equal(rows[0].meal_category, "café da manhã");
});

test("recibo de corrida vira UM item pelo total, não pelas partes do preço", () => {
  // "Preço da viagem R$ 15,47" + "Custo fixo R$ 1,50" = "Total R$ 16,97":
  // lançar as duas linhas cobrava a corrida quase duas vezes.
  const rows = itemsFromExtraction(
    {
      categoria: "UBER",
      valor_total: 16.97,
      itens: [
        { descricao: "Preço da viagem", valor: 15.47 },
        { descricao: "Custo fixo", valor: 1.5 },
      ],
    },
    0
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].description, "UBER");
  assert.equal(rows[0].value, "16.97");
});

test("cupom com produtos de verdade continua item a item", () => {
  const rows = itemsFromExtraction(
    {
      categoria: "ALMOÇO",
      valor_total: 38,
      itens: [
        { descricao: "Prato feito", valor: 30 },
        { descricao: "Suco", valor: 8 },
      ],
    },
    0
  );
  assert.equal(rows.length, 2);
});
