// Multa por devolução antecipada de equipamento alugado (contrato Selbet).
//
//   Multa = mensalidade × 3 ÷ 24 × meses restantes
//   meses restantes = (ano venc − ano dev) × 12 + mês venc − mês dev,
//                     +1 se o dia do vencimento for maior que o da devolução,
//                     no mínimo 0.
//
// O prazo é de 24 meses contados do início (a entrega do equipamento). O
// vencimento vem do início + 24 meses; sem início, vale o vencimento gravado.
// Arredonda só no fim, como a tabela da Selbet (26,225 × 19 = 498,28).
import { num } from './regras.js';

export const PRAZO_MESES = 24;
export const TAXA_MESES = 3;

const partes = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  return m ? { a: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null;
};
const iso = (a, m, d) => `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Data ISO + n meses. Dia que não existe no mês final cai no último dia. */
export function somarMeses(dataIso, n) {
  const p = partes(dataIso);
  if (!p) return null;
  const total = p.a * 12 + (p.m - 1) + n;
  const a = Math.floor(total / 12);
  const m = (total % 12) + 1;
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return iso(a, m, Math.min(p.d, ultimo));
}

export function mesesRestantes(vencimento, devolucao) {
  const v = partes(vencimento);
  const d = partes(devolucao);
  if (!v || !d) return null;
  const meses = (v.a - d.a) * 12 + v.m - d.m + (v.d > d.d ? 1 : 0);
  return Math.max(0, meses);
}

/** Vencimento que vale para a multa: início + 24 meses; sem início, o gravado. */
export function vencimentoEfetivo(a) {
  if (partes(a?.inicio_contrato)) return somarMeses(a.inicio_contrato, PRAZO_MESES);
  return partes(a?.vencimento_contrato) ? String(a.vencimento_contrato).slice(0, 10) : null;
}

/**
 * Multa de um ativo numa data de devolução (padrão: a gravada no ativo).
 * Devolve null quando falta mensalidade ou vencimento (equipamento próprio,
 * serviço, cadastro incompleto). `estimado`: o vencimento não veio do início.
 */
export function multaDevolucao(a, devolucao = a?.data_devolucao) {
  const mensal = num(a?.valor_mensal);
  const vencimento = vencimentoEfetivo(a);
  if (!mensal || !vencimento || !partes(devolucao)) return null;
  const meses = mesesRestantes(vencimento, devolucao);
  const porMes = (mensal * TAXA_MESES) / PRAZO_MESES;
  return {
    mensal,
    vencimento,
    devolucao: String(devolucao).slice(0, 10),
    meses,
    porMes: Math.round(porMes * 100) / 100,
    valor: Math.round(porMes * meses * 100) / 100,
    estimado: !partes(a?.inicio_contrato),
  };
}
