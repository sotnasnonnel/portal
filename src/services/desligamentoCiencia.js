// "Enviar para conhecimento" do desligamento — o DP escolhe quem fica sabendo
// (ADM, TI...) para organizar o recolhimento. Escrita só pelas RPCs: a tabela
// não tem policy de escrita (ver supabase_migration_desligamento_ciencia.sql).
import { supabase } from './supabase';

/** Envia o aviso (sino na hora; e-mail best-effort). Devolve quantos eram novos. */
export async function enviarCiencia(solicitacaoId, destinatarios, observacao) {
  const { data, error } = await supabase.rpc('desligamento_enviar_ciencia', {
    p_solicitacao: solicitacaoId,
    p_destinatarios: destinatarios,
    p_observacao: observacao || null,
  });
  if (error) throw error;
  try {
    await supabase.functions.invoke('notify-desligamento-ciencia', { body: { solicitacao_id: solicitacaoId } });
  } catch (err) {
    console.warn('[notify-desligamento-ciencia] falhou:', err?.message);
  }
  return data || 0;
}

/** Colaboradores ativos que podem receber o aviso (quem não vê desligamento fica de fora). */
export async function listarPossiveisDestinatarios() {
  const { data, error } = await supabase
    .from('colaboradores')
    .select('id, nome, funcao')
    .eq('ativo', true)
    .neq('pode_ver_desligamento', false)
    .order('nome');
  if (error) throw error;
  return data || [];
}

/** Avisos recebidos pelo usuário logado. */
export async function listarMeusAvisos() {
  const { data, error } = await supabase.rpc('desligamento_ciencia_minhas');
  if (error) throw error;
  return data || [];
}

export async function marcarCiente(id) {
  const { data, error } = await supabase.rpc('desligamento_ciencia_marcar', { p_id: id });
  if (error) throw error;
  return data;
}
