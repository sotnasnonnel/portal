import { supabase } from './supabase';

// Avisa por e-mail sobre um pedido de ausência programada ou de folga de campo
// (Edge Function notify-ausencia):
//   evento 'nova'     -> avisa o GESTOR que há um pedido pendente;
//   evento 'decidida' -> avisa o COLABORADOR do resultado.
//
// O sino não some: ele continua vindo do gatilho no banco. Este é o aviso por
// e-mail pedido por quem aprova, que não fica com o portal aberto.
//
// Best-effort, como as outras notificações do portal: o pedido já está gravado
// quando isto roda, e falha de e-mail não pode desfazer nem travar a tela.
export async function notificarAusencia(modulo, solicitacaoId, evento = 'nova') {
  if (!solicitacaoId) return;
  try {
    await supabase.functions.invoke('notify-ausencia', {
      body: { solicitacao_id: solicitacaoId, modulo, evento },
    });
  } catch (err) {
    console.warn('[notify-ausencia] falhou:', err?.message);
  }
}
