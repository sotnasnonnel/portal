import { supabase } from './supabase';

/**
 * Avisa por e-mail sobre os programas internos (Edge Function notify-programa).
 *
 *   'ideia_nova'        -> toda a empresa: alguém registrou ideia ou iniciativa
 *   'ideia_status'      -> toda a empresa: a situação de uma iniciativa mudou
 *   'alavanca_retorno'  -> quem indicou: resultado da avaliação da indicação
 *                          (elegível, não elegível, em evolução, concluída)
 *
 * Os dois primeiros são divulgação para a empresa inteira — é o que a planilha
 * pede, e é justamente por isso que a lista de destinatários é montada no
 * servidor: mandar a lista de e-mails daqui exporia o quadro de colaboradores
 * no bundle do navegador.
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
