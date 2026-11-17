// Formatação e tons de tela do módulo TI.

const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const money = (v, dash = '—') => {
  if (v == null || v === '') return dash;
  const n = Number(v);
  return Number.isFinite(n) ? fmtBRL.format(n) : dash;
};
export const fmtDate = (iso) => {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : '—';
};

/** Linha de tabela que abre o detalhe, também pelo teclado. */
export const linhaClicavel = (fn) => ({
  onClick: fn,
  tabIndex: 0,
  onKeyDown: (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) fn(); },
});

/** Cor da pílula pela situação do equipamento. */
export function tomSituacao(s) {
  if (s === 'Em utilização') return 'ok';
  if (s === 'Aguardando atribuição' || s === 'Em preparação' || s === 'Parado') return 'info';
  if (s === 'Recolhido' || s === 'Devolução') return 'neutral';
  if (s === 'Propriedade PHD') return 'brand';
  if (!s) return 'neutral';
  return 'crit';
}

/** Cor da pílula pela situação do termo. */
export function tomTermo(s) {
  if (s === 'Assinado') return 'ok';
  if (s === 'Termo gerado' || s === 'Termo existente - a validar') return 'info';
  if (s === 'Termo divergente' || s === 'Sem termo') return 'crit';
  if (s === 'A conferir') return 'warn';
  return 'neutral';
}
