// Opções do filtro por SOLICITANTE (quem abriu a requisição = gestor_id),
// distintas e ordenadas por nome. `nomes` resolve id->nome (via RPC
// nomes_colaboradores); cai no join gestor?.nome como fallback e em '—' se
// nenhum nome estiver disponível. Pura para ser testável fora da tela.
export function opcoesSolicitantes(participa, nomes = {}) {
  const m = new Map();
  for (const s of participa || []) {
    if (s?.gestor_id) m.set(s.gestor_id, nomes[s.gestor_id] || s.gestor?.nome || '—');
  }
  return [...m.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}
