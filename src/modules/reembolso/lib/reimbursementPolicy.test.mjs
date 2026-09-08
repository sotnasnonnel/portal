import test from "node:test";
import assert from "node:assert/strict";
import {
  alimentacaoDia,
  regiaoDoLocal,
  detectForbiddenItems,
  evaluateFoodOverage,
  evaluatePolicyOverage,
  itensExcedentes,
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

test("descrição corrigida manda no teto, não a categoria da IA", () => {
  // A IA leu a nota como CAFÉ (teto 20 em BH). A pessoa corrige a linha para
  // ALMOÇO: o teto tem de virar 40 junto, senão o almoço nasce estourado.
  const r = evaluateFoodOverage([
    item({ description: "ALMOÇO", meal_category: "CAFÉ", value: 38 }),
  ]);
  assert.equal(r.hasOverage, false);

  const antes = evaluateFoodOverage([
    item({ description: "CAFÉ DA MANHÃ", meal_category: "CAFÉ", value: 38 }),
  ]);
  assert.equal(antes.over, 18); // sem a correção, continua no teto do café
});

test("cafezinho no fim do almoço não rebaixa a nota ao teto do café", () => {
  // Mesma nota (mesmo nf_ref) = uma refeição só. Entre descrições que nomeiam
  // refeições diferentes vale o maior teto: a nota é o almoço.
  const r = evaluateFoodOverage([
    item({ description: "ALMOÇO EXECUTIVO", meal_category: "ALMOÇO", value: 34, nf_ref: "nf1" }),
    item({ description: "CAFÉ", meal_category: "ALMOÇO", value: 6, nf_ref: "nf1" }),
  ]);
  assert.equal(r.hasOverage, false); // R$ 40, teto de almoço em BH
});

test("descrição genérica não derruba a categoria da nota", () => {
  // "COMIDA" não nomeia refeição: quem classifica continua sendo a categoria
  // que a IA deu à nota (almoço, teto 40).
  const r = evaluateFoodOverage([
    item({ description: "COMIDA", meal_category: "ALMOÇO", value: 38 }),
  ]);
  assert.equal(r.hasOverage, false);
});

test("excedente aponta os itens que o compõem", () => {
  const r = evaluatePolicyOverage([
    item({ id: "a", description: "ALMOÇO", meal_category: "ALMOÇO", value: 60 }),
  ]);
  assert.deepEqual(
    r.exceeded[0].items.map((i) => i.id),
    ["a"]
  );
  assert.deepEqual([...itensExcedentes(
    [item({ id: "a", description: "ALMOÇO", meal_category: "ALMOÇO", value: 60 })],
    (i) => i.id
  )], ["a"]);
});

test("item dentro do teto fica de fora do realce", () => {
  const chaves = itensExcedentes(
    [
      item({ id: "ok", description: "ALMOÇO", meal_category: "ALMOÇO", value: 30 }),
      item({ id: "caro", description: "JANTAR", meal_category: "JANTAR", value: 90 }),
    ],
    (i) => i.id
  );
  assert.equal(chaves.has("ok"), false);
  assert.equal(chaves.has("caro"), true);
});

test("refeição não classificada usa o teto de almoço, não o do café", () => {
  // "COMIDA" é a categoria que a própria IA usa quando não dá para dizer se foi
  // almoço ou jantar. Cobrar dela o teto do café era cobrar uma linha que não
  // existe na tabela publicada.
  const r = evaluateFoodOverage([
    item({ description: "X-TUDO", meal_category: "COMIDA", value: 38 }),
  ]);
  assert.equal(r.hasOverage, false); // teto de almoço em BH: 40

  const fora = evaluateFoodOverage([
    item({
      description: "X-TUDO",
      meal_category: "COMIDA",
      value: 45,
      local: "RESTAURANTE, ITABIRA - MG",
    }),
  ]);
  assert.equal(fora.hasOverage, false); // teto de almoço fora de BH: 50
});

test("café continua no teto do café quando a nota diz que foi café", () => {
  const r = evaluateFoodOverage([
    item({ description: "PÃO DE QUEIJO", meal_category: "CAFÉ", value: 38 }),
  ]);
  assert.equal(r.over, 18); // teto 20 em BH
});

test("teto do dia continua freando quem repete refeição não classificada", () => {
  const r = evaluateFoodOverage([
    item({ description: "X-TUDO", meal_category: "COMIDA", value: 40, nf_ref: "n1" }),
    item({ description: "PRATO FEITO", meal_category: "COMIDA", value: 40, nf_ref: "n2" }),
    item({ description: "MARMITA", meal_category: "COMIDA", value: 40, nf_ref: "n3" }),
  ]);
  assert.equal(r.over, 20); // R$ 120 no dia, teto de BH é R$ 100
  assert.equal(r.allowed, 100);
});
