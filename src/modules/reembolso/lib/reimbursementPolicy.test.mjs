import test from "node:test";
import assert from "node:assert/strict";
import {
  POLICY,
  evaluateFoodOverage,
  evaluateLodgingOverage,
  evaluatePolicyOverage,
} from "./reimbursementPolicy.js";

const item = (o) => ({ qty: 1, item_date: "2026-08-27", ...o });

test("teto de alimentação do dia é a soma das três refeições", () => {
  assert.equal(POLICY.alimentacaoDia, 100);
});

test("máximo por dia é alimentação + hospedagem", () => {
  assert.equal(POLICY.diariaMaxima, 385);
  assert.equal(POLICY.diariaMaxima, POLICY.alimentacaoDia + POLICY.hospedagem);
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
  // 3 almoços de R$ 40 no mesmo dia: cada um cabe no teto da refeição, mas
  // R$ 120 passa dos R$ 100 do dia.
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

test("hospedagem: teto por diária, com a quantidade de noites", () => {
  const uma = evaluateLodgingOverage([
    item({ description: "Hospedagem hotel", meal_category: "HOSPEDAGEM", value: 320 }),
  ]);
  assert.equal(uma.over, 35);

  const tres = evaluateLodgingOverage([
    item({ description: "Hospedagem hotel", meal_category: "HOSPEDAGEM", value: 280, qty: 3 }),
  ]);
  assert.equal(tres.hasOverage, false); // 840 <= 285 × 3
});

test("alimentação e hospedagem são tetos independentes no mesmo dia", () => {
  const r = evaluatePolicyOverage([
    item({ description: "Almoço", meal_category: "ALMOÇO", value: 40 }),
    item({ description: "Jantar", meal_category: "JANTAR", value: 40 }),
    item({ description: "Café da manhã", meal_category: "CAFÉ", value: 20 }),
    item({ description: "Hospedagem", meal_category: "HOSPEDAGEM", value: 285 }),
  ]);
  assert.equal(r.hasOverage, false); // R$ 385 no dia: 100 + 285
  assert.equal(r.spent, 385);
});

test("excedente somado aponta os dois tetos", () => {
  const r = evaluatePolicyOverage([
    item({ description: "Almoço", meal_category: "ALMOÇO", value: 60 }),
    item({ description: "Hospedagem", meal_category: "HOSPEDAGEM", value: 300 }),
  ]);
  assert.equal(r.over, 35); // 20 da refeição + 15 da diária
  assert.ok(r.food.hasOverage && r.lodging.hasOverage);
});
