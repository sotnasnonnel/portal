import { supabase } from './supabase';

/**
 * Avisa por e-mail sobre os programas internos (Edge Function notify-programa).
 *
 *   'ideia_nova'        -> gerentes e diretoria: registraram ideia ou iniciativa
 *   'ideia_status'      -> gerentes e diretoria: a situação de uma mudou
 *   'alavanca_nova'     -> diretoria e time comercial: chegou indicação nova
 *   'alavanca_retorno'  -> quem indicou: resultado da avaliação da indicação
 *                          (elegível, não elegível, em evolução, concluída)
 *   'iniciativa_pedido_novo'   -> admins do módulo: pediram uma iniciativa
 *                                 da Inovação para uma obra
 *   'iniciativa_pedido_status' -> quem pediu: a Inovação respondeu
 *
 * Os três primeiros vão para uma lista, e é justamente por isso que ela é
 * montada no servidor: mandar a lista de e-mails daqui exporia o quadro de
 * colaboradores no bundle do navegador.
 *
 * Best-effort: o e-mail nunca derruba a ação que já foi gravada no banco. Se
 * falhar, a informação continua no portal — o e-mail é o aviso, não o registro.
 * Enquanto a Edge Function não estiver publicada, o módulo funciona inteiro e
 * só o aviso deixa de sair.
 */
export async function notificarPrograma(evento, dados = {}) {
  try {
    await supabase.functions.invoke('notify-programa', { body: { evento, ...dados } });
  } catch (err) {
    console.warn('[notify-programa] falhou:', err?.message);
  }
}
