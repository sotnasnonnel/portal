import { supabase } from './supabase';

// Avisa por e-mail quem tem a etapa pendente atual da requisição (Edge Function
// notify-solic-aprovador). Best-effort: nunca bloqueia nem quebra o fluxo.
export async function notificarAprovadorSolic(solicitacaoId) {
  try {
    await supabase.functions.invoke('notify-solic-aprovador', { body: { solicitacao_id: solicitacaoId } });
  } catch (err) {
    console.warn('[notify-solic-aprovador] falhou:', err?.message);
  }
}
