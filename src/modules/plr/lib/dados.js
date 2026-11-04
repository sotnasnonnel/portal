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

/**
 * O PLR por pessoa, já calculado com o que o HUB diz na hora e só com as linhas
 * que a pessoa pode ver. Forma da resposta: montarResultado, na Edge Function
 * plr-calculo.
 */
export async function carregarCalculo(ano) {
  const { data, error } = await supabase.functions.invoke('plr-calculo', { body: { ano } });
  if (error) throw error;
  return data;
}

/** A parte da empresa no PLR dos colaboradores, em fração (0,75 = 75%). */
export async function carregarMultEmpresa(ano) {
  const { data, error } = await supabase.rpc('plr_mult_empresa', { p_ano: ano });
  if (error) throw error;
  return Number(data);
}

/** Muda a parte da empresa (só admin; o banco confere). */
export async function salvarMultEmpresa(ano, valor) {
  const { error } = await supabase.rpc('plr_salvar_mult_empresa', { p_ano: ano, p_valor: valor });
  if (error) throw error;
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
