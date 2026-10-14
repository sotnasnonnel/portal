// Nomes de pessoas para exibir: o cadastro guarda em maiúsculas.

export const nomeProprio = (nome = '') => (nome || '').toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase());

// Cargo em frase: "ANALISTA DE DP" vira "Analista de dp" — título em cada
// palavra ("De Dp") lia pior que a caixa alta.
export const cargo = (t = '') => {
  const m = (t || '').toLowerCase();
  return m.charAt(0).toUpperCase() + m.slice(1);
};

export function iniciais(nome) {
  if (!nome) return '?';
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? '';
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
}
