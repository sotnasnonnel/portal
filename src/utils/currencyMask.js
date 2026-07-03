// Máscara de moeda pt-BR para inputs das requisições: ponto = milhar,
// vírgula = centavos. Puro (sem React), testável com `node --test`.

/**
 * Formata o texto digitado no padrão pt-BR enquanto o usuário digita.
 * Mantém apenas dígitos e a 1ª vírgula; agrupa a parte inteira com pontos
 * de milhar; limita a parte decimal a 2 casas. '' e null => ''.
 */
export function maskCurrencyInput(texto) {
  if (texto == null) return '';
  const s = String(texto);
  const iVirgula = s.indexOf(',');

  let inteiroRaw;
  let decimalRaw = '';
  const temVirgula = iVirgula !== -1;

  if (temVirgula) {
    inteiroRaw = s.slice(0, iVirgula).replace(/\D/g, '');
    decimalRaw = s.slice(iVirgula + 1).replace(/\D/g, '').slice(0, 2);
  } else {
    inteiroRaw = s.replace(/\D/g, '');
  }

  // Remove zeros à esquerda, preservando um único zero.
  inteiroRaw = inteiroRaw.replace(/^0+(?=\d)/, '');
  if (inteiroRaw === '' && temVirgula) inteiroRaw = '0';

  const inteiroFmt = inteiroRaw === ''
    ? ''
    : inteiroRaw.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return temVirgula ? `${inteiroFmt},${decimalRaw}` : inteiroFmt;
}

/**
 * Converte a string mascarada em número para envio ao banco.
 * '' / null => null. Ex.: '12.000,50' => 12000.5.
 */
export function parseCurrency(mascarado) {
  if (mascarado == null) return null;
  const s = String(mascarado).trim();
  if (s === '') return null;
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
