/**
 * Para onde o chamado vai quando alguém responde.
 *
 * É o que transforma a caixa de mensagem em fluxo de trabalho: responder move
 * a bola de campo, e o quadro reflete isso sem ninguém mexer em status à mão.
 *
 * Lógica pura para poder ser testada.
 */

export const STATUS_LABEL = {
  aguardando_aprovacao: 'Aguardando aprovação',
  aberto: 'Aberto',
  em_atendimento: 'Em atendimento',
  aguardando_solicitante: 'Aguardando solicitante',
  fechado: 'Fechado',
  reprovado: 'Reprovado',
  cancelado: 'Cancelado',
};

/** Estados em que o chamado ainda está em jogo. */
const EM_ANDAMENTO = new Set(['aberto', 'em_atendimento', 'aguardando_solicitante']);

/**
 * @returns {string|null} novo status, ou null quando responder não deve mudar nada.
 */
export function proximoStatusAoResponder({ statusAtual, souSolicitante, interna = false }) {
  // Nota interna é conversa do Adm consigo mesmo: não é resposta a ninguém e
  // não pode dar a impressão de que a bola voltou para o solicitante.
  if (interna) return null;

  // Chamado encerrado ou ainda em aprovação não muda de estado por mensagem.
  if (!EM_ANDAMENTO.has(statusAtual)) return null;

  const destino = souSolicitante ? 'em_atendimento' : 'aguardando_solicitante';
  return destino === statusAtual ? null : destino;
}
