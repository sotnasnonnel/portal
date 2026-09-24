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

/**
 * Estados de chamado ENCERRADO — acabou, não volta para a fila.
 *
 * Reprovado entra aqui junto com fechado: para quem pediu, um pedido negado
 * está tão concluído quanto um atendido, e deixá-lo em "em andamento" fazia o
 * chamado parecer vivo para sempre. Cancelado segue a mesma lógica.
 */
export const STATUS_ENCERRADOS = ['fechado', 'reprovado', 'cancelado'];

export const ehEncerrado = (status) => STATUS_ENCERRADOS.includes(status);

/**
 * Estados em que o chamado ainda está vivo, na ordem em que ele caminha.
 *
 * Derivado de STATUS_LABEL, e não escrito à mão: status novo entra no rótulo e
 * já aparece nos filtros, em vez de existir no banco e faltar na tela — que é
 * exatamente como os encerrados sumiram da Fila.
 */
export const STATUS_ABERTOS = Object.keys(STATUS_LABEL).filter((s) => !ehEncerrado(s));

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

/**
 * A etapa que espera a decisão DESTA pessoa, ou null.
 *
 * É a menor ordem ainda pendente, e só conta se o aprovador for ela: numa
 * cadeia, o segundo aprovador não decide antes do primeiro. Mesma régua da fila
 * em `listarAprovacoesPendentes` — escrita aqui como função pura porque agora
 * ela também decide o que a TELA DO CHAMADO mostra, e duas contas diferentes
 * para a mesma pergunta acabariam divergindo.
 *
 * Existe porque o aviso do sino leva o aprovador ao chamado, não à fila: quem
 * chegava por ali via a própria etapa marcada como pendente e nenhum botão para
 * decidir — foi o que a Perla relatou em 24/09/2026.
 */
export function etapaQueEsperaPorMim(etapas = [], meuId, statusDoChamado) {
  if (!meuId || statusDoChamado !== 'aguardando_aprovacao') return null;
  const pendentes = etapas
    .filter((e) => e.status === 'pendente')
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  const vez = pendentes[0];
  return vez && vez.aprovador_id === meuId ? vez : null;
}
