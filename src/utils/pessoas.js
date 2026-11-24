// Nomes de pessoas para exibir: o cadastro guarda em maiúsculas.

/**
 * onChange de campo de nome: põe o texto em MAIÚSCULAS enquanto se digita e
 * devolve o valor. Corrige o próprio input antes do React ler, mantendo o
 * cursor no lugar (editar no meio do nome não pula para o fim). O banco
 * também grava em maiúsculas (supabase_migration_nomes_maiusculas.sql).
 */
export function valorMaiusculo(e) {
  const el = e.target;
  const maiusc = el.value.toUpperCase();
  if (maiusc !== el.value) {
    const { selectionStart: ini, selectionEnd: fim } = el;
    el.value = maiusc;
    if (ini != null) el.setSelectionRange(ini, fim);
  }
  return maiusc;
}

export const nomeProprio =(nome = '') => (nome || '').toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase());

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
