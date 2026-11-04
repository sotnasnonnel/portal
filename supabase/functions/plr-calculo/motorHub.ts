// deno-lint-ignore-file no-explicit-any

// Motor do PLR do HUB PHD: a parte que o portal precisa para chegar no mesmo
// número que a tela do HUB mostra.
//
// O HUB não guarda fator nem resultado: ele guarda as linhas (meta, resultado,
// peso, regra) e faz a conta na tela. Para o portal mostrar o Fator PLR
// corporativo, a % de cada setor e o valor da gerência, a conta precisa existir
// aqui também. Estas funções são CÓPIA de src/pages/plr/plrEngine.js do repo
// app-phd (commit 8ec7880): quando a regra mudar lá, tem de mudar aqui junto.
//
// Sem dependência de Deno: motorHub.test.ts roda no `node --test`.

type Linha = any;
type Dados = any;
type Pessoa = any;
export type Base = "proj" | "ytd";

// Margem Operacional Líquida abaixo disto (fração da meta) zera o PLR inteiro.
export const TRIGGER_CORTE = 0.6999;

const PREMISSAS_PADRAO = { indMode: "setor", lucroOn: false, lucroPct: 1, lucroPiso: 0.8, phd36: false, supOn: false };

const numOuNull = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

function normalizarSetores(setores: unknown, setorAntigo: unknown = null): string[] {
  const bruto = Array.isArray(setores) && setores.length ? setores : setorAntigo ? [setorAntigo] : [];
  return [...new Set(bruto.map((s) => String(s ?? "").trim()).filter(Boolean))];
}

/** Linha de plr_pessoa (numeric pode vir como texto) → pessoa do motor. */
export function pessoaDoBanco(r: any): Pessoa {
  return {
    id: r.id,
    chave: r.chave,
    nome: r.nome,
    cargo: r.cargo || "",
    nivel: r.nivel || "",
    area: r.area || "",
    salario: Number(r.salario) || 0,
    multPlr: Number(r.mult_plr) || 0,
    multBonus: Number(r.mult_bonus) || 0,
    teto: numOuNull(r.teto),
    setores: normalizarSetores(r.setores, r.setor),
    indSetor: r.ind_setor || null,
    metas: Array.isArray(r.metas) ? r.metas : [],
    bonus: Array.isArray(r.bonus) ? r.bonus : [],
    over: r.over_mc || null,
    sup: !!r.sup,
    variavel: r.variavel || null,
    ordem: Number(r.ordem) || 0,
  };
}

/** Linhas de plr_parametro e plr_pessoa do ano → o `D` do motor. */
export function montarDados(parametros: any[], pessoas: any[]): Dados {
  const porChave = Object.fromEntries((parametros || []).map((p) => [p.chave, p]));
  const v = (k: string) => porChave[k]?.valor ?? null;
  return {
    painel: { indicadores: v("painel")?.indicadores || [] },
    setores: v("setores")?.setores || [],
    pessoas: (pessoas || []).map(pessoaDoBanco).sort((a, b) => a.ordem - b.ordem),
    variavel: v("variavel"),
    premissas: { ...PREMISSAS_PADRAO, ...(v("premissas") || {}) },
    automaticos: v("automaticos"),
  };
}

// --- Réguas ------------------------------------------------------------------

/** `ratio` = resultado ÷ meta; `ad` = quanto paga (0 a 1). Sem meta ou resultado: `nd`. */
export function ader(regra: string, meta: any, res: any) {
  if (meta === null || res === null || meta === undefined || res === undefined) return { ratio: null, ad: 0, nd: true };
  if (regra === "prazo") {
    const d = (new Date(res).getTime() - new Date(meta).getTime()) / 864e5; // dias de atraso
    return { ratio: Number.isNaN(d) ? 0 : d <= 0 ? 1 : 0, ad: Number.isNaN(d) ? 0 : d <= 0 ? 1 : d <= 30 ? 0.5 : 0, atraso: d };
  }
  const ratio = meta ? res / meta : 0;
  let ad;
  if (regra === "teto") ad = ratio > 1 ? 0 : 1;
  else if (regra === "inv") {
    const e = res > 0 ? meta / res : meta > 0 ? 9 : 0;
    ad = e >= 0.95 ? Math.min(e, 1) : e >= 0.9 ? 0.5 : 0;
  } else if (regra === "p70") ad = ratio >= 0.95 ? Math.min(ratio, 1) : ratio >= 0.7 ? 0.5 : 0;
  else ad = ratio >= 0.95 ? Math.min(ratio, 1) : ratio >= 0.9 ? 0.5 : 0;
  return { ratio, ad };
}

// --- Automático × manual -----------------------------------------------------

const usaAuto = (l: Linha) => !!(l?.fonte && l.auto && !l.manual);

/** {meta, res} que valem para a linha: o automático, se houver e ninguém editou. */
export function efetivo(l: Linha) {
  if (usaAuto(l)) return { meta: l.auto.meta ?? l.meta, res: l.auto.res ?? l.res };
  return { meta: l?.meta, res: l?.res };
}

/** efetivo() do painel corporativo: o automático só substitui a base YTD. */
export function efetivoBase(l: Linha, base: Base) {
  const b = l?.[base] || { meta: null, res: null };
  if (base === "ytd" && usaAuto(l)) return { meta: l.auto.meta ?? b.meta, res: l.auto.res ?? b.res };
  return { meta: b.meta, res: b.res };
}

/** Faturamento do over da MC: o automático do gerente ou o digitado. */
function fatOver(o: any) {
  if (usaAuto(o)) return { meta: o.auto.meta ?? o.fatMeta, res: o.auto.res ?? o.fatRes };
  return { meta: o?.fatMeta, res: o?.fatRes };
}

// --- Scorecards --------------------------------------------------------------

export function indScore(rows: Linha[]) {
  return (rows || []).reduce((a, i) => {
    const { meta, res } = efetivo(i);
    return a + ader(i.regra, meta, res).ad * (Number(i.peso) || 0);
  }, 0);
}

/** A % do setor: é o que o card "Setores" do HUB mostra. */
export const setorScore = (s: any) => indScore(s?.ind);

/** Responsável pelo setor: a primeira pessoa, na ordem, que responde por ele. */
export const respOf = (D: Dados, setorId: string) =>
  (D?.pessoas || []).find((p: Pessoa) => (p.setores || []).includes(setorId)) || null;

function indOf(D: Dados, p: Pessoa) {
  if (p?.metas?.length) return { rows: p.metas, nome: "Metas individuais", tipo: "pessoa" };
  const s = p?.indSetor ? (D?.setores || []).find((x: any) => x.id === p.indSetor) : null;
  if (s) return { rows: s.ind, nome: s.nome, tipo: "setor", setorId: s.id };
  return null;
}

// --- PLR ---------------------------------------------------------------------

export function plrLinhas(D: Dados, p: Pessoa | null, base: Base) {
  const modo = D?.premissas?.indMode || "setor";
  const I = p ? indOf(D, p) : null;
  return (D?.painel?.indicadores || []).map((l: Linha) => {
    let { meta, res } = efetivoBase(l, base);
    let a;
    let origem = "";
    if (l.individual && I && modo !== "arquivo") {
      const sc = indScore(I.rows);
      meta = 1; res = sc; origem = I.nome;
      a = modo === "setorRegua" ? ader("p90", 1, sc) : { ratio: sc, ad: Math.min(sc, 1) };
    } else a = ader(l.regra, meta, res);
    return { ...l, meta, res, ratio: a.ratio, ad: a.ad, nd: a.nd, contrib: a.ad * l.peso, origem };
  });
}

export function plrCalc(D: Dados, p: Pessoa | null, base: Base) {
  const lines = plrLinhas(D, p, base);
  const mol = lines.find((l: Linha) => l.trigger) || null;
  const trig = !!mol && mol.ratio !== null && mol.ratio < TRIGGER_CORTE;
  const sum = lines.reduce((a: number, l: Linha) => a + l.contrib, 0);
  return { lines, trig, pct: trig ? 0 : sum, mol };
}

/** Fator da empresa: metas individuais pela linha da planilha, igual para todos. */
export function corpFator(D: Dados, base: Base) {
  return plrCalc({ ...D, premissas: { ...D?.premissas, indMode: "arquivo" } }, null, base);
}

// --- Bônus -------------------------------------------------------------------

function overCalc(p: Pessoa) {
  if (!p?.over) return null;
  const o = p.over;
  const linha = p.bonus?.[o.mc ?? 0];
  if (!linha) return null;
  const mc = efetivo(linha);
  const fat = fatOver(o);
  const fatMeta = Number(fat.meta) || 0;
  const fatRes = Number(fat.res) || 0;
  const mcMetaR = fatMeta * mc.meta * 1e6;
  const mcResR = fatRes * mc.res * 1e6;
  const dif = mcResR - mcMetaR;
  const bruto = Math.max(0, dif) * 0.035;
  const teto = (Number(o.teto) || 0) * p.salario;
  return {
    fatMeta, fatRes, mcMeta: mc.meta, mcRes: mc.res, mcMetaR, mcResR, dif, bruto, teto,
    valor: Math.min(bruto, teto),
    fatOk: fatMeta ? fatRes / fatMeta >= 1.1 : false,
    mcOk: mc.meta ? mc.res / mc.meta >= 1.1 : false,
  };
}

function bonusCalc(D: Dados, p: Pessoa) {
  const lines = (p?.bonus || []).map((i: Linha) => {
    const { meta, res } = efetivo(i);
    const a = ader(i.regra, meta, res);
    return { ...i, meta, res, ratio: a.ratio, ad: a.ad, nd: a.nd, contrib: a.ad * i.peso, atraso: a.atraso };
  });
  const O = overCalc(p);
  const mode = p?.over ? "over" : "score";
  let pct = lines.reduce((a: number, l: Linha) => a + l.contrib, 0);
  let valor;
  if (mode === "over" && O) {
    valor = O.valor;
    pct = p.multBonus ? valor / (p.multBonus * p.salario) : 0;
  } else valor = p.multBonus * pct * p.salario;
  const pr = D?.premissas || {};
  const block = !!pr.lucroOn && pr.lucroPct < pr.lucroPiso;
  const supOk = !!(p.sup && pr.supOn && O && O.mcOk);
  return { lines, O, mode, pct: block ? 0 : pct, valor: block ? 0 : valor, sup: !block && supOk ? p.salario : 0, supOk, block };
}

// --- Variável de vendas ------------------------------------------------------

function varCalc(D: Dados, p: Pessoa) {
  const V = D?.variavel;
  const d = p?.variavel;
  if (!V || !d) return null;
  const meses = (V.meses || []).map((mes: string, i: number) => {
    const venda = Number(d.venda?.[i]) || 0;
    const ok = venda >= V.gatilhoMes;
    return { mes, venda, ok, bruto: ok ? venda * 1e6 * V.pct : 0 };
  });
  const tri = [0, 1, 2].map((t) => {
    const ms = meses.slice(t * 3, t * 3 + 3);
    const bruto = ms.reduce((a: number, m: any) => a + m.bruto, 0);
    return { bruto, pago: Math.min(bruto, V.tetoTri) };
  });
  const extra = D?.premissas?.phd36 ? V.extraPHD : 0;
  return { total: tri.reduce((a, t) => a + t.pago, 0) + extra };
}

// --- Tudo de uma pessoa ------------------------------------------------------

/** O valor completo do executivo no HUB, na base pedida. */
export function calc(D: Dados, p: Pessoa, base: Base) {
  const P = plrCalc(D, p, base);
  const B = bonusCalc(D, p);
  const V = varCalc(D, p);
  const r: any = { plr: p.salario * p.multPlr * P.pct, bon: B.valor, sup: B.sup, var: V ? V.total : 0 };
  r.total = r.plr + r.bon + r.sup + r.var;
  return { p, P, B, V, r };
}
