import { supabase } from './supabase';

// Avisa por e-mail o solicitante de que sua requisição foi devolvida para
// ajustes (Edge Function notify-solic-devolvida). Best-effort: nunca bloqueia
// nem quebra o fluxo de devolução.
export async function notificarSolicitanteDevolucao(solicitacaoId) {
  try {
    await supabase.functions.invoke('notify-solic-devolvida', { body: { solicitacao_id: solicitacaoId } });
  } catch (err) {
    console.warn('[notify-solic-devolvida] falhou:', err?.message);
  }
}
