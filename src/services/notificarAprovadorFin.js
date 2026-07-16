import { supabase } from './supabase';

// Avisa por e-mail quem tem a etapa pendente atual da solicitação do Financeiro
// (Edge Function notify-financeiro-aprovador). Na etapa de execução, avisa todas
// as admins do Financeiro. Best-effort: nunca bloqueia nem quebra o fluxo.
export async function notificarAprovadorFin(solicitacaoId) {
  try {
    await supabase.functions.invoke('notify-financeiro-aprovador', { body: { solicitacao_id: solicitacaoId } });
  } catch (err) {
    console.warn('[notify-financeiro-aprovador] falhou:', err?.message);
  }
}
