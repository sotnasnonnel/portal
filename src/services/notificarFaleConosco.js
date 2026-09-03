import { supabase } from './supabase';

/**
 * Avisa por e-mail quem escreveu no Fale conosco que a mensagem foi respondida
 * (Edge Function notify-fale-conosco). O sino do portal já avisa por trigger;
 * o e-mail leva a resposta inteira até a pessoa, sem depender de ela voltar.
 *
 * Best-effort: o e-mail nunca derruba a resposta que já foi gravada no banco.
 */
export async function notificarFaleConoscoRespondido(id) {
  try {
    await supabase.functions.invoke('notify-fale-conosco', { body: { id } });
  } catch (err) {
    console.warn('[notify-fale-conosco] falhou:', err?.message);
  }
}
