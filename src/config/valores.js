// Quem edita a tela "Ajustes de Valores" (/valores).
//
// Duas portas, como na Consulta do Organograma (config/organograma.js): o
// perfil de gestor/admin do DP, que já entrava, e a flag `valores_ajuste`
// (Gerenciar acessos), que libera só esta tela para quem não é do DP — foi o
// caso do Patrick, atendente do Atendimento, em 25/09/2026.
//
// A diferença em relação ao organograma é que aqui a permissão é de ESCRITA: a
// mesma regra está na policy de precos_itens
// (supabase_migration_valores_ajuste.sql). Se as duas divergirem, quem manda é
// o banco — a tela mostraria os campos e o salvamento falharia.

export const PERFIS_COM_VALORES = ['gestor', 'admin'];

export function podeAjustarValores(user) {
  if (!user) return false;
  return PERFIS_COM_VALORES.includes(user.perfil) || user.valoresAjuste === true;
}

/** Só a flag, sem o perfil — é o que faz o grupo "Consultas" aparecer para quem não é do DP. */
export function soPelaFlagDeValores(user) {
  return !!user && !PERFIS_COM_VALORES.includes(user.perfil) && user.valoresAjuste === true;
}
