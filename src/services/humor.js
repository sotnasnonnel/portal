import { supabase } from './supabase';

// Humor do dia e aniversariantes do mês. Tudo por RPC
// (supabase/supabase_migration_humor_aniversariantes.sql): o humor de outra
// pessoa nunca sai do banco — só o próprio e o resumo agregado.

function checar(error) {
  if (error) throw new Error(error.message || 'Falha ao falar com o banco.');
}

export async function registrarHumor(valor) {
  const { error } = await supabase.rpc('humor_registrar', { p_humor: valor });
  checar(error);
}

/** O que eu marquei hoje, ou null. */
export async function meuHumorHoje() {
  const { data, error } = await supabase.rpc('humor_meu_hoje');
  checar(error);
  return data ?? null;
}

/** Linhas por dia: { dia, total, muito_mal, triste, ok, feliz, muito_feliz }. */
export async function resumoHumor({ de, ate, escopo = 'equipe' }) {
  const { data, error } = await supabase.rpc('humor_resumo', { p_de: de, p_ate: ate, p_escopo: escopo });
  checar(error);
  return data || [];
}

/** { colaborador_id, nome, funcao, tipo: 'aniversario'|'tempo_casa', dia, anos_casa }. */
export async function aniversariantesDoMes(mes = null) {
  const { data, error } = await supabase.rpc('aniversariantes_mes', { p_mes: mes });
  checar(error);
  return data || [];
}
