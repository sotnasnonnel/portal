import { supabase } from './supabase';

/**
 * Ids de toda a equipe do usuário logado: subordinados diretos + as equipes
 * dos coordenadores abaixo (RPC recursiva get_minha_equipe).
 */
export async function getEquipeIds() {
  const { data, error } = await supabase.rpc('get_minha_equipe');
  if (error) throw error;
  return (data || []).map((r) => r.id);
}
