// Regras da central de Aprovações — lógica pura, testável com `node --test`.
//
// A central não tem tabela própria. Cada item é lido do módulo de origem e
// decidido pela MESMA função que a tela do módulo usa, então a decisão já
// aparece lá, com os mesmos avisos. Aqui ficam só as regras de "é a minha vez",
// a ordem e o agrupamento.

import { evaluatePolicyOverage, detectForbiddenItems } from '../../reembolso/lib/reimbursementPolicy.js';

/** Ordem dos grupos na tela. */
export const FONTES = [
  { chave: 'dp', modulo: 'Requisições do DP' },
  { chave: 'ausencia', modulo: 'Ausência Programada' },
  { chave: 'adicional', modulo: 'Adicional de Ausências' },
  { chave: 'folga', modulo: 'Folga de Campo' },
  { chave: 'horas_extras', modulo: 'Horas Extras' },
  { chave: 'atendimento', modulo: 'Atendimento' },
  { chave: 'financeiro', modulo: 'Financeiro' },
  { chave: 'reembolso', modulo: 'Reembolso e Adiantamento' },
];

export const nomeDaFonte = (chave) => FONTES.find((f) => f.chave === chave)?.modulo || chave;

/** O mais antigo primeiro: é o que está esperando há mais tempo. */
export function ordenarPendencias(itens = []) {
  return [...itens].sort((a, b) => String(a.quando || '').localeCompare(String(b.quando || '')));
}

/** Grupos na ordem de FONTES, só os que têm item. */
export function agruparPorFonte(itens = []) {
  return FONTES
    .map((f) => ({ ...f, itens: ordenarPendencias(itens.filter((i) => i.fonte === f.chave)) }))
    .filter((g) => g.itens.length > 0);
}

/** Reprovar sempre pede o motivo — é o que o solicitante vai ler. */
export function erroDaDecisao({ aprovar, comentario = '' }) {
  if (!aprovar && !String(comentario).trim()) return 'Informe o motivo da reprovação.';
  return '';
}

/**
 * Ausência Programada e Folga de Campo: pendente, não é da própria pessoa, e
 * está no meu nome — ou sem aprovador nenhum, quando sou do RH.
 *
 * O RH decide qualquer pedido pela tela do módulo, mas trazer TODOS para a
 * central encheria a caixa dele com o que é de cada gestor. Aqui entra só o
 * que não tem mais ninguém para decidir.
 */
export function minhaVezNaAusencia(s, userId, ehRh = false) {
  if (!s || s.status !== 'pendente' || s.colaborador_id === userId) return false;
  if (s.aprovador_id) return s.aprovador_id === userId;
  return ehRh;
}

/**
 * Adicional de Ausências: pendente, não registrei nem sou o beneficiado, e está
 * no meu nome — ou sem aprovador, quando sou do RH (mesma lógica da ausência).
 */
export function minhaVezNoAdicional(r, userId, ehRh = false) {
  if (!r || r.status !== 'pendente') return false;
  if (r.registrado_por === userId || r.colaborador_id === userId) return false;
  if (r.aprovador_id) return r.aprovador_id === userId;
  return ehRh;
}

/** Reembolso: o gestor atribuído, nunca sobre o próprio pedido (ReembolsoDetail). */
export function minhaVezNoReembolso(r, profile) {
  return !!profile && profile.role === 'gestor'
    && r?.status === 'em_analise'
    && r.manager_id === profile.id
    && r.requester_id !== profile.id;
}

/** Prestação de contas de adiantamento esperando o gestor. */
export function prestacaoEsperandoGestor(r, profile) {
  return !!profile && profile.role === 'gestor'
    && r?.kind === 'adiantamento'
    && r.manager_id === profile.id
    && r.accountability_status === 'em_analise';
}

/**
 * Por que este reembolso não pode ser aprovado direto da central — ou ''.
 *
 * Com excedente de alimentação o gestor escolhe entre o total e o valor com
 * desconto, e com item proibido precisa ver qual é: as duas decisões pedem a
 * tela do pedido, com as notas. Adiantamento não tem teto por refeição.
 */
export function motivoParaAbrirReembolso(r, itens = []) {
  if (r?.kind === 'adiantamento') return '';
  const doPedido = itens.filter((it) => !it.is_accountability);
  if (evaluatePolicyOverage(doPedido).hasOverage) {
    return 'Tem excedente de alimentação: abra o pedido para escolher entre o total e o valor com desconto.';
  }
  if (detectForbiddenItems(doPedido).hasForbidden) {
    return 'Tem item fora da política: abra o pedido para conferir antes de decidir.';
  }
  return '';
}
