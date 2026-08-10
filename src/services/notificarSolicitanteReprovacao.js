import { supabase } from './supabase';

// Avisa por e-mail o SOLICITANTE de que sua requisição foi reprovada, com o
// motivo e um convite a responder (Edge Function notify-solic-reprovada).
// Best-effort: nunca bloqueia nem quebra o fluxo de reprovação.
export async function notificarSolicitanteReprovacao(solicitacaoId) {
  try {
    await supabase.functions.invoke('notify-solic-reprovada', { body: { solicitacao_id: solicitacaoId } });
  } catch (err) {
    console.warn('[notify-solic-reprovada] falhou:', err?.message);
  }
}
