// Formatação de tela da Frota. Mesmos formatos do protótipo.
import { isNum, parseISO, comps, lastComp } from './regras.js';

export const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtBRL0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
export const fmtInt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const fmtDec2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const money = (v, dash = '—') => (isNum(v) ? fmtBRL.format(v) : dash);
export const money0 = (v) => (isNum(v) ? fmtBRL0.format(v) : '—');
export const km = (v) => (isNum(v) ? `${fmtInt.format(v)} km` : '—');
export const int = (v) => (isNum(v) ? fmtInt.format(v) : '—');
export const dec = (v) => (isNum(v) && v !== 0 ? fmtDec2.format(v) : '—');
export const decZ = (v) => (isNum(v) ? fmtDec2.format(v) : '—');
export const fmtDate = (s) => {
  const d = parseISO(s);
  return d ? d.toLocaleDateString('pt-BR') : '—';
};
export const iniciais = (n) => String(n || '').split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join('') || '—';

/** Competência escolhida na tela, se ainda existir; senão a mais recente. */
export const compResolvida = (escolhida, mensal) => (
  escolhida && comps(mensal).includes(escolhida) ? escolhida : lastComp(mensal)
);

/** Linha de tabela que abre o detalhe, também pelo teclado. */
export const linhaClicavel = (fn) => ({
  onClick: fn,
  tabIndex: 0,
  onKeyDown: (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) fn(); },
});
