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

/**
 * { colaborador_id, nome, funcao, tipo: 'aniversario'|'tempo_casa', dia, mes,
 *   anos_casa, email, celebra_em }.
 *
 * `celebra_em` é o dia da comemoração que ainda está em cartaz (null = fora da
 * janela do fim de semana) e só nessas linhas vem o e-mail. Sem `mes` a lista
 * pedida é do mês corrente, mas pode trazer quem comemorou no fim de semana do
 * mês anterior.
 */
export async function aniversariantesDoMes(mes = null) {
  const { data, error } = await supabase.rpc('aniversariantes_mes', { p_mes: mes });
  checar(error);
  return data || [];
}

/**
 * Fotos de quem está na lista do mês, vindas do hub: { [colaborador_id]: url }.
 * Falha vira {} — sem foto, a Home mostra as iniciais.
 */
export async function fotosAniversariantes() {
  const { data, error } = await supabase.functions.invoke('fotos-aniversariantes', { body: {} });
  if (error) return {};
  return data?.fotos || {};
}

/**
 * Fotos de quem escreveu no mural de parabéns de alguém, vindas do hub:
 * { fotos: { [colaborador_id]: url }, ids: [colaborador_id] }. A mesma Edge
 * Function das fotos da Home, que tira a lista de pessoas da RPC
 * parabens_mural — e não do cliente. `ids` é quem foi consultado, com ou sem
 * foto. Falha vira vazio — sem foto, o recado mostra as iniciais.
 */
export async function fotosDoMural(colaboradorId) {
  const { data, error } = await supabase.functions.invoke('fotos-aniversariantes', {
    body: { mural: colaboradorId },
  });
  if (error) return { fotos: {}, ids: [] };
  return { fotos: data?.fotos || {}, ids: data?.ids || [] };
}
