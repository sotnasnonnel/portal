// Aviso de entrada da Home: a pessoa logada tem equipamento em uso sem termo
// aceito? Lê ti_ativos pela RLS que já existe (a pessoa vê os dela e da equipe)
// e filtra os DELA aqui; o gestor recebe só o próprio aviso, não o da equipe.
import { supabase } from '../../../services/supabase';
import { emailChave, pendenteTermo } from './regras';

/** Equipamentos da pessoa com termo pendente ([] se nenhum ou se der erro). */
export async function meusEquipamentosSemTermo(email) {
  const eu = emailChave(email);
  if (!eu) return [];
  const { data, error } = await supabase
    .from('ti_ativos')
    .select('id, numero_serie, tipo, modelo, responsavel, situacao, situacao_termo')
    .eq('situacao', 'Em utilização')
    .or('situacao_termo.is.null,situacao_termo.neq.Assinado');
  // Sem a tabela ou sem acesso, a Home segue sem o aviso.
  if (error) return [];
  return (data || []).filter((a) => emailChave(a.responsavel) === eu && pendenteTermo(a));
}

const CHAVE = 'portal:aviso-termo-ti';

/** Uma vez por sessão do navegador (fechou o navegador, volta a aparecer). */
export function avisoTermoJaVisto(email) {
  try {
    return sessionStorage.getItem(CHAVE) === emailChave(email);
  } catch {
    return false;
  }
}

export function marcarAvisoTermoVisto(email) {
  try {
    sessionStorage.setItem(CHAVE, emailChave(email));
  } catch {
    // armazenamento bloqueado: o aviso só volta na próxima vez que a Home abrir
  }
}
