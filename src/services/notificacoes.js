// Central de notificações do portal — leitura e baixa.
//
// Quem CRIA são gatilhos no banco (ver supabase_migration_notificacoes.sql):
// aqui só se lê o que chegou e se marca como lida. A RLS já limita tudo ao
// destinatário, então nenhuma consulta daqui precisa filtrar por usuário.
import { supabase } from './supabase';

/** Disparado quando a lista muda, para o sino atualizar sem recarregar a página. */
export const NOTIF_EVENT = 'notificacoes_atualizadas';

const avisar = () => window.dispatchEvent(new Event(NOTIF_EVENT));

/** Últimas notificações (não lidas primeiro é decisão da tela, não da consulta). */
export async function listarNotificacoes({ limite = 30 } = {}) {
  const { data, error } = await supabase
    .from('notificacoes')
    .select('id, modulo, tipo, titulo, descricao, href, referencia_id, lida_em, created_at')
    .order('created_at', { ascending: false })
    .limit(limite);
  if (error) throw error;
  return data || [];
}

export async function contarNaoLidas() {
  const { count, error } = await supabase
    .from('notificacoes')
    .select('id', { count: 'exact', head: true })
    .is('lida_em', null);
  if (error) throw error;
  return count || 0;
}

export async function marcarLida(id) {
  const { error } = await supabase
    .from('notificacoes')
    .update({ lida_em: new Date().toISOString() })
    .eq('id', id)
    .is('lida_em', null);
  if (error) throw error;
  avisar();
}

export async function marcarTodasLidas() {
  const { error } = await supabase
    .from('notificacoes')
    .update({ lida_em: new Date().toISOString() })
    .is('lida_em', null);
  if (error) throw error;
  avisar();
}

/**
 * Escuta novas notificações em tempo real (a tabela está na publicação do
 * Realtime). Devolve a função de cancelamento.
 *
 * O sino também recarrega ao ganhar foco: se o socket cair, a lista não fica
 * congelada até a próxima navegação.
 */
export function ouvirNotificacoes(colaboradorId, aoChegar) {
  if (!colaboradorId) return () => {};
  const canal = supabase
    .channel(`notificacoes:${colaboradorId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notificacoes',
        filter: `destinatario_id=eq.${colaboradorId}`,
      },
      (payload) => aoChegar?.(payload.new)
    )
    .subscribe();
  return () => supabase.removeChannel(canal);
}
