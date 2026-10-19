import { supabase } from './supabase';

/**
 * Avisa o aniversariante, por e-mail, que um colega deixou recado no mural
 * (Edge Function notify-parabens).
 *
 * Só para recado NOVO: editar o próprio recado não manda outro e-mail. Quem
 * escreveu sai do JWT na Edge Function, então aqui vai só o aniversariante.
 *
 * Best-effort: o e-mail nunca derruba o recado que já está gravado no banco.
 */
export async function notificarParabens(aniversarianteId) {
  if (!aniversarianteId) return;
  try {
    await supabase.functions.invoke('notify-parabens', { body: { para: aniversarianteId } });
  } catch (err) {
    console.warn('[notify-parabens] falhou:', err?.message);
  }
}
