import { supabase } from './supabase';

// Personalização: tudo por RPC (supabase/supabase_migration_pontos*.sql).
// Cada item custa pontos (pontos_itens.custo), e quem dá e tira pontos é
// sempre o banco (_pontos_volta.sql).

function checar(error) {
  if (error) throw new Error(error.message || 'Falha ao falar com o banco.');
}

/** Pontos do login de hoje (e as boas-vindas). Idempotente no dia. */
export async function registrarAcesso() {
  const { data, error } = await supabase.rpc('pontos_registrar_acesso');
  checar(error);
  return data?.[0] ?? null;
}

/** { saldo, sequencia, perfil, compras } */
export async function meuResumo() {
  const { data, error } = await supabase.rpc('pontos_meu_resumo');
  checar(error);
  return data;
}

export async function catalogo() {
  const { data, error } = await supabase
    .from('pontos_itens')
    .select('id, categoria, nome, descricao, grupo, mes, custo')
    .eq('ativo', true)
    .order('ordem');
  checar(error);
  return data || [];
}

export async function comprar(itemId, texto = null) {
  const { data, error } = await supabase.rpc('pontos_comprar', { p_item: itemId, p_texto: texto });
  checar(error);
  return data;
}

export async function usar(itemId, ligar) {
  const { error } = await supabase.rpc('pontos_usar', { p_item: itemId, p_ligar: ligar });
  checar(error);
}

/** O que outras pessoas usam: Map colaborador_id -> { moldura, titulo, titulo_texto, aniversario, mural }. */
export async function visuais(ids) {
  const unicos = [...new Set(ids.filter(Boolean))];
  if (unicos.length === 0) return new Map();
  const { data, error } = await supabase.rpc('pontos_visuais', { p_ids: unicos });
  if (error) return new Map();
  return new Map((data || []).map((v) => [v.colaborador_id, v]));
}

export async function muralDe(colaboradorId) {
  const { data, error } = await supabase.rpc('parabens_mural', { p_para: colaboradorId });
  checar(error);
  return data || [];
}

export async function enviarParabens(colaboradorId, texto, icones = []) {
  const { data, error } = await supabase.rpc('parabens_enviar', { p_para: colaboradorId, p_texto: texto, p_icones: icones });
  checar(error);
  return data;
}

/** Últimos movimentos: { pontos, motivo, descricao, criado_em }. */
export async function extrato(limite = 30) {
  const { data, error } = await supabase.rpc('pontos_extrato', { p_limite: limite });
  checar(error);
  return data || [];
}

/** Apaga o meu recado no mural de quem está em cartaz (hoje ou o fim de semana). */
export async function excluirParabens(colaboradorId) {
  const { error } = await supabase.rpc('parabens_excluir', { p_para: colaboradorId });
  checar(error);
}

/**
 * Curtida do aniversariante num recado do próprio mural (liga e desliga).
 * O banco confere que o recado é para quem está chamando.
 */
export async function curtirParabens(recadoId, curtir) {
  const { error } = await supabase.rpc('parabens_curtir', { p_recado: recadoId, p_curtir: curtir });
  checar(error);
}

/** Resposta do aniversariante a um recado. Texto vazio apaga a resposta. */
export async function responderParabens(recadoId, texto) {
  const { error } = await supabase.rpc('parabens_responder', { p_recado: recadoId, p_texto: texto });
  checar(error);
}

/** Liga/desliga os sustos aleatórios do tema Halloween. */
export async function definirSustos(ligar) {
  const { error } = await supabase.rpc('pontos_definir_sustos', { p_ligar: ligar });
  checar(error);
}
