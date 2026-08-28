// Máscara de telefone brasileiro para inputs: (31) 9 9999-9999 no celular e
// (31) 3333-3333 no fixo. Pura (sem React), testável com `node --test`.

const digitos = (v) => String(v ?? '').replace(/\D/g, '').slice(0, 11);

/**
 * Formata enquanto a pessoa digita. Vai montando a máscara conforme os dígitos
 * chegam, sem "prender" o cursor: 3 -> "(3", 31 -> "(31", 3199 -> "(31) 99".
 *
 * O nono dígito do celular fica separado — (31) 9 9999-9999 — que é como a
 * operadora do cartão pede o contato do portador. O fixo, com 10 dígitos, sai
 * no formato de sempre.
 */
export function mascaraTelefone(valor) {
  const d = digitos(valor);
  if (!d) return '';
  if (d.length <= 2) return `(${d}`;

  const ddd = d.slice(0, 2);
  const resto = d.slice(2);

  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  if (d.length <= 10) return `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`;
  return `(${ddd}) ${resto.slice(0, 1)} ${resto.slice(1, 5)}-${resto.slice(5)}`;
}

/** Fixo (10) ou celular (11). Menos que isso é número incompleto. */
export const telefoneValido = (valor) => [10, 11].includes(digitos(valor).length);

/** Só os dígitos — para comparar ou guardar sem a máscara, quando precisar. */
export const telefoneDigitos = digitos;
