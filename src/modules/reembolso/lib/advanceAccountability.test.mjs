import { test } from "node:test";
import assert from "node:assert";
import { reconcileAdvance } from "./advanceAccountability.js";

test("sobra quando comprovado < adiantado", () => {
  const r = reconcileAdvance({ total: 1000, accountabilityTotal: 850 });
  assert.equal(r.adiantado, 1000);
  assert.equal(r.comprovado, 850);
  assert.equal(r.diff, 150);
  assert.equal(r.outcome, "sobra");
  assert.equal(r.expectedSettlement, "devolvido");
});

test("falta quando comprovado > adiantado", () => {
  const r = reconcileAdvance({ total: 1000, accountabilityTotal: 1200 });
  assert.equal(r.diff, -200);
  assert.equal(r.outcome, "falta");
  assert.equal(r.expectedSettlement, "complemento_pago");
});

test("exato quando comprovado == adiantado", () => {
  const r = reconcileAdvance({ total: 1000, accountabilityTotal: 1000 });
  assert.equal(r.diff, 0);
  assert.equal(r.outcome, "exato");
  assert.equal(r.expectedSettlement, "sem_acerto");
});

test("valores nulos viram zero", () => {
  const r = reconcileAdvance({ total: null, accountabilityTotal: null });
  assert.equal(r.adiantado, 0);
  assert.equal(r.comprovado, 0);
  assert.equal(r.outcome, "exato");
});
