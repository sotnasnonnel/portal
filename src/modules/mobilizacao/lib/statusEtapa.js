/**
 * Situação de uma ETAPA — a unidade de trabalho da Mobilização.
 *
 * A planilha só tinha "feito / não feito" (a célula com 1 ou vazia). "Em
 * andamento" existe aqui porque o quadro precisa mostrar o que alguém já pegou:
 * sem esse estado, duas pessoas puxam o mesmo passo e ninguém percebe.
 *
 * "Dispensada" é o passo que não se aplica àquele processo — desmobilização sem
 * crachá para devolver, por exemplo. Conta como resolvido para o progresso, mas
 * NÃO conta como cumprimento de prazo: não houve prazo a cumprir.
 *
 * Lógica pura para poder ser testada.
 */

export const STATUS_LABEL = {
  pendente: 'A fazer',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  dispensada: 'Não se aplica',
};

/** Estados em que a etapa saiu do jogo. */
export const STATUS_ENCERRADOS = ['concluida', 'dispensada'];

export const ehEncerrada = (status) => STATUS_ENCERRADOS.includes(status);

/** Estados em que a etapa ainda está em jogo — os que o atraso persegue. */
export const STATUS_ABERTOS = ['pendente', 'em_andamento'];

export const estaAberta = (etapa) => STATUS_ABERTOS.includes(etapa?.status);

export const rotuloStatus = (status) => STATUS_LABEL[status] || status || '—';
