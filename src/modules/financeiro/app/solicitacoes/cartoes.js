import { supabase } from '../../../../services/supabase';

/**
 * "Cartão" não é uma entidade própria: é uma solicitação de Cartão Virtual já
 * CONCLUÍDA (executada) da pessoa. Este módulo concentra essa regra.
 */

const hoje = () => new Date().toISOString().slice(0, 10);

/** Dentro da vigência? Vitalício nunca vence; sem data de fim, não vence. */
export const naVigencia = (c) => c.vitalicio || !c.periodo_fim || c.periodo_fim >= hoje();

/**
 * Limite atual do cartão. Como "Novo valor" do aumento é o NOVO LIMITE TOTAL,
 * o limite vigente é o valor do ÚLTIMO aumento concluído — ou o valor original
 * do cartão, se nunca houve aumento.
 */
export function limiteAtual(cartao, aumentosConcluidos) {
  const doCartao = (aumentosConcluidos || [])
    .filter((a) => a.cartao_id === cartao.id)
    .sort((a, b) => String(a.concluida_em || '').localeCompare(String(b.concluida_em || '')));
  const ultimo = doCartao[doCartao.length - 1];
  return Number(ultimo ? ultimo.valor : cartao.valor) || 0;
}

/**
 * Cartões da pessoa aptos a receber aumento: Cartão Virtual concluído e dentro
 * da vigência. Devolve cada cartão já com o `limite` atual calculado.
 * A RLS garante que só vêm os do próprio solicitante.
 */
export async function listarCartoesDoSolicitante(solicitanteId) {
  const { data: cartoes, error } = await supabase
    .from('solicitacoes_financeiro')
    .select('id, numero, nome_despesa, centro_custo, valor, vitalicio, periodo_inicio, periodo_fim, aplicacao, concluida_em')
    .eq('solicitante_id', solicitanteId)
    .eq('tipo', 'cartao_virtual')
    .eq('status', 'concluida')
    .order('concluida_em', { ascending: false });
  if (error) throw error;

  const vigentes = (cartoes || []).filter(naVigencia);
  if (vigentes.length === 0) return [];

  const { data: aumentos } = await supabase
    .from('solicitacoes_financeiro')
    .select('cartao_id, valor, concluida_em')
    .eq('tipo', 'aumento_limite')
    .eq('status', 'concluida')
    .in('cartao_id', vigentes.map((c) => c.id));

  return vigentes.map((c) => ({ ...c, limite: limiteAtual(c, aumentos || []) }));
}
