// Filtro de opções do SearchSelect (busca por substring, sem acento-sensível ao
// caixa). Puro e isolado para ser testável fora do componente.
//   options: [{ value, label }] ; q: texto digitado.
export function filtrarOpcoes(options, q) {
  const t = (q || '').trim().toLowerCase();
  if (!t) return options;
  return options.filter((o) => (o.label || '').toLowerCase().includes(t));
}
