import { supabase } from './supabase';
import { etapaAtual } from '../config/aprovacao';
import { notificarAprovadorSolic } from './notificarAprovadorSolic';
import { notificarSolicitanteReprovacao } from './notificarSolicitanteReprovacao';

// Decisão de uma requisição do DP (solicitacoes_rh).
//
// Morava dentro da tela de Acompanhar Requisições. Saiu para cá quando nasceu a
// central de Aprovações: as duas telas precisam gravar exatamente do mesmo
// jeito, com os mesmos avisos — duas cópias divergiriam no primeiro ajuste.
//
// Devolve 'ok' ou 'ja_tratada' (a etapa não estava mais pendente no meu nome:
// outra pessoa decidiu antes, ou a lista estava velha). Erro de banco lança.
export async function decidirRequisicaoRh({ sol, userId, aprovar, comentario = '' }) {
  const atual = etapaAtual(sol.etapas);
  if (!atual) return 'ja_tratada';
  const coment = comentario.trim();
  if (!aprovar && !coment) throw new Error('Informe a justificativa da reprovação.');
  const agora = new Date().toISOString();

  // O filtro por aprovador e status é a trava de concorrência: UPDATE barrado
  // não dá erro, dá zero linhas.
  const { data, error } = await supabase
    .from('solicitacoes_rh_etapas')
    .update({ status: aprovar ? 'aprovada' : 'reprovada', justificativa: coment || null, decidido_em: agora })
    .eq('id', atual.id)
    .eq('aprovador_id', userId)
    .eq('status', 'pendente')
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) return 'ja_tratada';

  if (!aprovar) {
    const { error: e2 } = await supabase
      .from('solicitacoes_rh')
      .update({ status: 'reprovada', updated_at: agora })
      .eq('id', sol.id);
    if (e2) throw e2;
    notificarSolicitanteReprovacao(sol.id);   // avisa o solicitante (best-effort)
  } else {
    notificarAprovadorSolic(sol.id);
  }
  window.dispatchEvent(new Event('solicitacoes_rh_atualizadas'));
  return 'ok';
}
