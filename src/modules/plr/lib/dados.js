import { supabase } from '../../../services/supabase';

// Leitura e escrita do PLR. As tabelas não têm policy: tudo passa pelas RPCs
// de supabase_migration_plr.sql, que já devolvem só os setores que a pessoa
// pode ver.

/** { papel, setores: [{ ..., indicadores: [...] }] } do ano. */
export async function carregarPainel(ano) {
  const { data, error } = await supabase.rpc('plr_painel', { p_ano: ano });
  if (error) throw error;
  return { papel: data?.papel ?? null, setores: data?.setores ?? [] };
}

/** Grava a referência e os indicadores de um setor (só admin; o banco confere). */
export async function salvarSetor(setorId, referencia, indicadores) {
  const { error } = await supabase.rpc('plr_salvar_setor', {
    p_setor_id: setorId,
    p_referencia: referencia,
    p_indicadores: indicadores,
  });
  if (error) throw error;
}
