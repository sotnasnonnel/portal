// ===== Motor de aprovação das solicitações do Financeiro =====
// Portado da lógica do DP (config/aprovacao.js), adaptado para o Financeiro:
// a etapa final de EXECUÇÃO é única e pode ser feita por QUALQUER admin do
// Financeiro (aprovador_id = null); a primeira das executoras que agir conclui.
import { supabase } from '../services/supabase';

// Executoras oficiais do Financeiro (geram os cartões e avisam os responsáveis).
// Mantidas aqui por referência; o que realmente habilita a execução é ter
// financeiro_role='admin' (checado pela RLS e pelo front via user.financeiroRole).
export const EXECUTORES_FIN = [
  { id: '1f6fda3d-2175-4956-9e1d-205b87796251', nome: 'DANIELA SEBRIAN', email: 'daniela.sebrian@phdengenharia.eng.br' },
  { id: '67baf407-547d-4a94-8c30-9de37cd719e5', nome: 'ALESSANDRA ANDRADE SOBRAL', email: 'alessandra.sobral@phdengenharia.eng.br' },
];

export const TIPO_LABEL_FIN = {
  cartao_virtual: 'Cartão Virtual',
  aumento_limite: 'Aumento de Limite',
};

const PAPEL_EXECUCAO = 'Financeiro (execução)';

/**
 * Busca o fluxo configurado do solicitante para um tipo.
 * Retorna { fluxo, erro } — distingue erro de rede de "não configurado".
 */
export async function buscarFluxoFin(solicitanteId, tipo) {
  const { data, error } = await supabase
    .from('solicitacoes_financeiro_fluxos')
    .select('*')
    .eq('solicitante_id', solicitanteId)
    .eq('tipo', tipo)
    .maybeSingle();
  if (error) return { fluxo: null, erro: error };
  return { fluxo: data || null, erro: null };
}

/**
 * Monta as linhas de etapas a partir da cadeia configurada.
 * - aprovadores: array ORDENADO de colaborador_id.
 * - criadorId: aplica auto-aprovação nas etapas cujo aprovador é o criador.
 * A etapa final de EXECUÇÃO é sempre acrescentada (aprovador_id null = qualquer
 * admin do Financeiro).
 */
export function montarEtapasFin(solicitacaoId, aprovadores, criadorId, nomePorId) {
  const agora = new Date().toISOString();
  const ids = (Array.isArray(aprovadores) ? aprovadores : [])
    .map((x) => (typeof x === 'string' ? x.trim().toLowerCase() : ''))
    .filter(Boolean);

  const linhas = ids.map((id, i) => {
    const nome = nomePorId[id];
    if (!nome) throw new Error(`Aprovador sem nome resolvido (id ${id}). Recarregue e tente de novo.`);
    const autoAprova = id === (criadorId || '').toLowerCase();
    return {
      solicitacao_id: solicitacaoId,
      ordem: i + 1,
      aprovador_id: id,
      papel: nome,
      tipo_etapa: 'aprovacao',
      status: autoAprova ? 'auto_aprovada' : 'pendente',
      decidido_em: autoAprova ? agora : null,
    };
  });

  linhas.push({
    solicitacao_id: solicitacaoId,
    ordem: ids.length + 1,
    aprovador_id: null,          // qualquer admin do Financeiro executa
    papel: PAPEL_EXECUCAO,
    tipo_etapa: 'execucao',
    status: 'pendente',
    decidido_em: null,
  });

  return linhas;
}

/**
 * Etapa atual = primeira etapa de aprovação/execução ainda pendente (menor ordem).
 * Se QUALQUER etapa foi reprovada, o fluxo está encerrado (sem etapa atual).
 */
export function etapaAtualFin(etapas) {
  const lista = etapas || [];
  if (lista.some((e) => e.status === 'reprovada')) return null;
  return (
    lista
      .filter((e) => (e.tipo_etapa === 'aprovacao' || e.tipo_etapa === 'execucao') && e.status === 'pendente')
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))[0] || null
  );
}

/**
 * Ação disponível AGORA para o usuário: 'aprovacao' | 'execucao' | null.
 * - aprovação: o usuário é o aprovador nomeado da etapa atual.
 * - execução: etapa atual é de execução e o usuário é admin do Financeiro
 *   (aprovador_id null) ou o aprovador nomeado (caso raro de execução fixa).
 */
export function acaoDisponivelFin(userId, etapas = [], isFinAdmin = false) {
  const atual = etapaAtualFin(etapas);
  if (!atual) return null;
  if (atual.tipo_etapa === 'execucao') {
    if (atual.aprovador_id ? atual.aprovador_id === userId : isFinAdmin) return 'execucao';
    return null;
  }
  return atual.aprovador_id === userId ? 'aprovacao' : null;
}

/** Resumo textual do andamento. */
export function resumoAndamentoFin(solicitacao, etapas) {
  const lista = etapas || [];
  const nomeDe = (etapa) => etapa?.papel || 'Responsável';
  if (solicitacao.status === 'reprovada') {
    const rep = lista.find((e) => e.status === 'reprovada');
    return { texto: `Reprovada por ${nomeDe(rep)}`, tom: 'reprovada' };
  }
  if (solicitacao.status === 'concluida') {
    return { texto: 'Concluída / Executada', tom: 'concluida' };
  }
  const atual = etapaAtualFin(etapas);
  if (!atual) return { texto: 'Em andamento', tom: 'pendente' };
  if (atual.tipo_etapa === 'execucao') return { texto: 'Aguardando execução do Financeiro', tom: 'pendente' };
  return { texto: `Aguardando aprovação de ${nomeDe(atual)}`, tom: 'pendente' };
}
