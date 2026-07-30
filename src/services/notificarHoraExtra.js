import { supabase } from './supabase';

// Avisa por e-mail sobre uma solicitação de hora extra (Edge Function
// notify-hora-extra):
//   evento 'nova'     -> avisa o GESTOR que há uma aprovação pendente;
//   evento 'decidida' -> avisa o COLABORADOR do resultado (destino ou motivo).
// Best-effort: nunca bloqueia nem quebra o fluxo já gravado no banco.
export async function notificarHoraExtra(solicitacaoId, evento = 'nova') {
  try {
    await supabase.functions.invoke('notify-hora-extra', {
      body: { solicitacao_id: solicitacaoId, evento },
    });
  } catch (err) {
    console.warn('[notify-hora-extra] falhou:', err?.message);
  }
}
