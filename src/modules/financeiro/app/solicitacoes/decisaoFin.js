import { supabase } from '../../../../services/supabase';
import { etapaAtualFin } from '../../../../config/aprovacaoFinanceiro';
import { registrarAuditoria } from '../../../../services/alcadas';
import { notificarAprovadorFin } from '../../../../services/notificarAprovadorFin';

// Decisão (aprovação ou parecer) de uma solicitação do Financeiro.
//
// Morava dentro da tela Aprovar / Acompanhar. Saiu para cá quando nasceu a
// central de Aprovações, que precisa gravar, auditar e avisar exatamente como
// a tela do módulo. A EXECUÇÃO (o Financeiro efetivar) continua só no módulo:
// é operação, não aprovação.

/** Trilha de auditoria (§6, pilar 4): quem agiu, quando, sobre que valor. */
export function auditarFin(sol, etapa, evento, observacao, user) {
  return registrarAuditoria({
    modulo: 'financeiro',
    solicitacao_id: sol.id,
    numero: sol.numero,
    tipo: sol.tipo,
    evento,
    ator_id: user?.id || null,
    ator_nome: user?.nome || null,
    papel_codigo: etapa?.papel_codigo || null,
    valor: sol.valor ?? null,
    alcada_tabela: 'compras',
    nivel_base: sol.alcada_nivel_base ?? null,
    nivel_final: sol.alcada_nivel_final ?? null,
    excecoes: sol.alcada_excecoes || [],
    observacao: observacao || null,
  });
}

/**
 * Aprova (ou dá parecer favorável) ou reprova a etapa atual.
 * Devolve 'ok' ou 'ja_tratada' (a etapa não estava mais pendente).
 */
export async function decidirSolicitacaoFin({ sol, user, aprovar, comentario = '' }) {
  const atual = etapaAtualFin(sol.etapas);
  if (!atual) return 'ja_tratada';
  const ehParecer = atual.tipo_etapa === 'parecer';
  const coment = comentario.trim();
  const agora = new Date().toISOString();

  const { data, error } = await supabase
    .from('solicitacoes_financeiro_etapas')
    .update({ status: aprovar ? 'aprovada' : 'reprovada', justificativa: coment || null, decidido_em: agora })
    .eq('id', atual.id)
    .eq('status', 'pendente')
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) return 'ja_tratada';

  if (!aprovar) {
    await supabase.from('solicitacoes_financeiro').update({ status: 'reprovada', updated_at: agora }).eq('id', sol.id);
    auditarFin(sol, atual, 'reprovacao', coment || `Reprovada na etapa "${atual.papel}"`, user);
  } else {
    auditarFin(sol, atual, ehParecer ? 'parecer' : 'aprovacao',
      coment || `${ehParecer ? 'Parecer favorável' : 'Aprovada'} na etapa "${atual.papel}"`, user);
    // Aprovou: avisa quem passa a ser o responsável da vez.
    notificarAprovadorFin(sol.id);
  }
  window.dispatchEvent(new Event('solicitacoes_financeiro_atualizadas'));
  return 'ok';
}
