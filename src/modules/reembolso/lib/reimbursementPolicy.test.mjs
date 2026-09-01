import test from "node:test";
import assert from "node:assert/strict";
import {
  alimentacaoDia,
  regiaoDoLocal,
  detectForbiddenItems,
  evaluateFoodOverage,
  evaluatePolicyOverage,
} from "./reimbursementPolicy.js";

// Local padrão dos testes: Belo Horizonte, a coluna mais apertada da tabela
// (café 20 / almoço 40 / jantar 40, R$ 100 no dia).
const item = (o) => ({
  qty: 1,
  item_date: "2026-08-27",
  local: "RESTAURANTE X, BELO HORIZONTE - MG",
  ...o,
});

test("teto de alimentação do dia é a soma das três refeições da região", () => {
  assert.equal(alimentacaoDia("bh"), 100);
  assert.equal(alimentacaoDia("brasil"), 130);
  assert.equal(alimentacaoDia("intl"), 200);
});

test("sem local reconhecido vale a faixa das demais cidades do Brasil", () => {
  assert.equal(regiaoDoLocal(""), "brasil");
  assert.equal(regiaoDoLocal("PADARIA FAMILIA PIRES LTDA, ITABIRA - MG"), "brasil");
  assert.equal(regiaoDoLocal("BAR DO ZÉ, BELO HORIZONTE/MG"), "bh");
  assert.equal(regiaoDoLocal("TAQUERIA, CIUDAD DE MEXICO"), "intl");
  assert.equal(regiaoDoLocal("COMEDOR, GUATEMALA"), "intl");
});

test("mesma refeição tem teto maior fora de BH", () => {
  const bh = evaluateFoodOverage([
    item({ description: "Almoço", meal_category: "ALMOÇO", value: 48 }),
  ]);
  assert.equal(bh.over, 8); // teto 40

  const fora = evaluateFoodOverage([
    item({
      description: "Almoço",
      meal_category: "ALMOÇO",
      value: 48,
      local: "RESTAURANTE, ITABIRA - MG",
    }),
  ]);
  assert.equal(fora.hasOverage, false); // teto 50

  const mex = evaluateFoodOverage([
    item({
      description: "Almoço",
      meal_category: "ALMOÇO",
      value: 75,
      local: "TAQUERIA, CANCUN",
    }),
  ]);
  assert.equal(mex.hasOverage, false); // teto 80
});

test("combustível não é bebida alcoólica", () => {
  // "Gasolina Original" / "Etanol Original": o nome do combustível da Ipiranga
  // carrega "GIN" dentro de "ORIGINAL" e casava com a chave da bebida.
  const r = detectForbiddenItems([
    { description: "GASOLINA ORIGINAL", value: 200 },
    { description: "ETANOL ORIGINAL", value: 150 },
    { description: "ALCOOL COMUM", value: 100 },
    { description: "GASOLINA ADITIVADA", value: 180 },
  ]);
  assert.equal(r.hasForbidden, false);
});

test("bebida alcoólica de verdade continua sinalizada", () => {
  const r = detectForbiddenItems([
    { description: "CERVEJA LATA 350ML", value: 8 },
    { description: "Vinhos tinto seco", value: 60 },
    { description: "GIN TONICA", value: 30 },
    { description: "PAO DE QUEIJO", value: 6 },
  ]);
  assert.equal(r.items.length, 3);
  assert.ok(r.items.every((i) => i.label === "Bebida alcoólica"));
});

test("refeição dentro do teto não gera excedente", () => {
  const r = evaluateFoodOverage([
    item({ description: "Almoço", meal_category: "ALMOÇO", value: 38 }),
    item({ description: "Café da manhã", meal_category: "CAFÉ", value: 18 }),
  ]);
  assert.equal(r.hasOverage, false);
  assert.equal(r.over, 0);
});

test("refeição acima do teto da refeição corta o excedente", () => {
  const r = evaluateFoodOverage([
    item({ description: "Almoço", meal_category: "ALMOÇO", value: 60 }),
  ]);
  assert.equal(r.over, 20);
  assert.equal(r.allowed, 40);
});

test("teto do DIA pega três refeições que cabem uma a uma", () => {
  // 3 almoços de R$ 40 em BH no mesmo dia: cada um cabe no teto da refeição,
  // mas R$ 120 passa dos R$ 100 do dia.
  const r = evaluateFoodOverage([
    item({ description: "Almoço 1", meal_category: "ALMOÇO", value: 40 }),
    item({ description: "Almoço 2", meal_category: "ALMOÇO", value: 40 }),
    item({ description: "Almoço 3", meal_category: "ALMOÇO", value: 40 }),
  ]);
  assert.equal(r.over, 20);
  assert.equal(r.allowed, 100);
  assert.ok(r.exceeded.some((e) => e.label === "Alimentação do dia"));
});

test("teto do dia conta cada dia separadamente", () => {
  const r = evaluateFoodOverage([
    item({ description: "Almoço", meal_category: "ALMOÇO", value: 40, item_date: "2026-08-26" }),
    item({ description: "Jantar", meal_category: "JANTAR", value: 40, item_date: "2026-08-26" }),
    item({ description: "Almoço", meal_category: "ALMOÇO", value: 40, item_date: "2026-08-27" }),
    item({ description: "Jantar", meal_category: "JANTAR", value: 40, item_date: "2026-08-27" }),
  ]);
  assert.equal(r.hasOverage, false); // R$ 80 em cada dia
});

test("hospedagem não tem mais teto no reembolso", () => {
  // Passou a ser tratada em outra plataforma: a nota de hotel entra pelo valor
  // cheio e não é confundida com refeição.
  const r = evaluatePolicyOverage([
    item({ description: "Hospedagem hotel", meal_category: "HOSPEDAGEM", value: 900 }),
  ]);
  assert.equal(r.hasOverage, false);
  assert.equal(r.over, 0);
});

test("excedente aponta a refeição e a região", () => {
  const r = evaluatePolicyOverage([
    item({ description: "Almoço", meal_category: "ALMOÇO", value: 60 }),
  ]);
  assert.equal(r.over, 20); // teto de BH: 40
  assert.equal(r.exceeded[0].regiao, "Belo Horizonte — MG");
});
