import { supabase } from './supabase';

// Humor do dia e aniversariantes do mês. Tudo por RPC
// (supabase/supabase_migration_humor_aniversariantes.sql e
// supabase_migration_humor_individual.sql): do banco sai o próprio registro, o
// resumo agregado e, só para o RH, as respostas por pessoa.

function checar(error) {
  if (error) throw new Error(error.message || 'Falha ao falar com o banco.');
}

/** Grava o estado inteiro do dia: comentário vazio apaga o que havia. */
export async function registrarHumor(valor, comentario = '') {
  const { error } = await supabase.rpc('humor_registrar_identificado', {
    p_humor: valor, p_comentario: comentario,
  });
  checar(error);
}

/** O que eu marquei hoje: { humor, comentario }, ou null. */
export async function meuHumorHoje() {
  const { data, error } = await supabase.rpc('humor_meu_registro_hoje');
  checar(error);
  return data?.[0] ?? null;
}

/** Só RH: { dia, colaborador_id, nome, funcao, humor, comentario }, do mais recente. */
export async function respostasHumor({ de, ate }) {
  const { data, error } = await supabase.rpc('humor_respostas', { p_de: de, p_ate: ate });
  checar(error);
  return data || [];
}

/** Linhas por dia: { dia, total, muito_mal, triste, ok, feliz, muito_feliz }. */
export async function resumoHumor({ de, ate, escopo = 'equipe' }) {
  const { data, error } = await supabase.rpc('humor_resumo', { p_de: de, p_ate: ate, p_escopo: escopo });
  checar(error);
  return data || [];
}

/** { colaborador_id, nome, funcao, tipo: 'aniversario'|'tempo_casa', dia, anos_casa, email }. */
export async function aniversariantesDoMes(mes = null) {
  const { data, error } = await supabase.rpc('aniversariantes_mes', { p_mes: mes });
  checar(error);
  return data || [];
}
