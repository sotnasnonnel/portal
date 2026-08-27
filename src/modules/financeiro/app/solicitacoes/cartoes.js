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

/**
 * Situação de um cartão para a tela de acompanhamento. Não é uma coluna do
 * banco: sai do status da solicitação + a vigência.
 *   em_aprovacao -> a solicitação ainda está na cadeia
 *   reprovado    -> a solicitação foi reprovada (nunca virou cartão)
 *   ativo        -> concluída e dentro da vigência
 *   vencido      -> concluída, mas a vigência acabou
 */
export function situacaoCartao(c) {
  if (c.status === 'pendente') return 'em_aprovacao';
  if (c.status === 'reprovada') return 'reprovado';
  return naVigencia(c) ? 'ativo' : 'vencido';
}

/**
 * Cartões da pessoa para a tela "Meus Cartões": TODA solicitação de cartão
 * dela, em qualquer status, com o limite vigente e os aumentos que ainda estão
 * em aprovação.
 *
 * Diferente de `listarCartoesDoSolicitante`, que serve ao formulário de aumento
 * e por isso só devolve o que pode receber aumento (concluído e vigente). Aqui
 * a pessoa precisa ver também o que está em aprovação e o que já venceu.
 */
export async function listarMeusCartoes(solicitanteId) {
  const [{ data: cartoes, error }, { data: aumentos }] = await Promise.all([
    supabase
      .from('solicitacoes_financeiro')
      .select('id, numero, nome_despesa, centro_custo, valor, vitalicio, periodo_inicio, periodo_fim, aplicacao, status, created_at, concluida_em, modalidade_cartao, endereco_entrega')
      .eq('solicitante_id', solicitanteId)
      .eq('tipo', 'cartao_virtual')
      .order('created_at', { ascending: false }),
    supabase
      .from('solicitacoes_financeiro')
      .select('id, numero, cartao_id, valor, status, concluida_em')
      .eq('solicitante_id', solicitanteId)
      .eq('tipo', 'aumento_limite'),
  ]);
  if (error) throw error;

  const todos = aumentos || [];
  const concluidos = todos.filter((a) => a.status === 'concluida');

  return (cartoes || []).map((c) => ({
    ...c,
    situacao: situacaoCartao(c),
    // Limite vigente: o último aumento concluído ou o valor original.
    limite: limiteAtual(c, concluidos),
    // Aumentos ainda na cadeia — é o que explica "pedi mais e não mudou nada".
    aumentosEmAprovacao: todos.filter((a) => a.cartao_id === c.id && a.status === 'pendente'),
  }));
}
