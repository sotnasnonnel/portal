import { supabase } from './supabase';

/**
 * Avisa por e-mail sobre um chamado do Administrativo (Edge Function
 * notify-chamado-adm). Só as partes envolvidas recebem — nunca o time inteiro.
 *
 *   'aprovacao'   -> aprovador da vez: há chamado esperando decisão
 *   'decidido'    -> solicitante: aprovado ou reprovado (com o motivo)
 *   'atendimento' -> técnico: o chamado caiu na fila dele
 *   'mensagem'    -> o outro lado: há resposta nova
 *   'fechado'     -> solicitante: concluído, com o convite para avaliar
 *
 * Best-effort: o e-mail nunca derruba a ação que já foi gravada no banco. Se
 * falhar, a informação continua no portal — o e-mail é o aviso, não o registro.
 */
export async function notificarChamadoAdm(chamadoId, evento) {
  try {
    await supabase.functions.invoke('notify-chamado-adm', {
      body: { chamado_id: chamadoId, evento },
    });
  } catch (err) {
    console.warn('[notify-chamado-adm] falhou:', err?.message);
  }
}
