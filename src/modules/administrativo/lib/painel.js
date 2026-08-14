/**
 * Regras de exibição do painel do Adm (fila, quadro e listas).
 * Lógica pura, testável — sem Supabase e sem React.
 */

/** Colunas do quadro, na ordem em que o chamado caminha. */
export const COLUNAS_KANBAN = [
  { chave: 'aguardando_aprovacao', titulo: 'Aguardando aprovação', status: ['aguardando_aprovacao'] },
  { chave: 'aberto', titulo: 'A fazer', status: ['aberto'] },
  { chave: 'em_atendimento', titulo: 'Em atendimento', status: ['em_atendimento'] },
  { chave: 'aguardando_solicitante', titulo: 'Aguardando solicitante', status: ['aguardando_solicitante'] },
  // Encerrados juntos: separar em três colunas encheria o quadro de coisa que
  // ninguém precisa mais olhar.
  { chave: 'concluido', titulo: 'Concluído', status: ['fechado', 'reprovado', 'cancelado'] },
];

export function agruparEmColunas(chamados = []) {
  const porStatus = new Map();
  for (const col of COLUNAS_KANBAN) {
    porStatus.set(col.chave, chamados.filter((c) => col.status.includes(c.status)));
  }
  return COLUNAS_KANBAN.map((col) => ({ ...col, itens: porStatus.get(col.chave) || [] }));
}

/**
 * Semáforo do prazo. Sem vencimento não há o que semaforizar — chamado
 * aguardando aprovação ainda não teve o relógio ligado, e pintar de verde
 * sugeriria folga que não existe.
 */
export function semaforoPrazo(slaVenceEm, agora = Date.now()) {
  if (!slaVenceEm) return 'sem-prazo';
  const faltam = new Date(slaVenceEm).getTime() - agora;
  if (faltam < 0) return 'vencido';
  if (faltam <= 24 * 3600 * 1000) return 'perto';
  return 'ok';
}

/**
 * Mensagens ainda não lidas por MIM neste chamado.
 *
 * O que eu mesmo escrevi nunca conta: a coluna de leitura do meu lado fica
 * nula porque eu não "li" a própria mensagem, e sem esse filtro todo chamado
 * apareceria com pendência logo depois de eu responder.
 */
export function contarNaoLidas(interacoes = [], { meuId, souSolicitante }) {
  const campo = souSolicitante ? 'lida_solicitante_em' : 'lida_atendente_em';
  return interacoes.filter((i) => i.autor_id !== meuId && !i[campo]).length;
}

/**
 * Filtra o quadro por solicitante e por centro de custo.
 *
 * Serve ao caso "como está tudo de um projeto crítico": o CC é o que amarra os
 * chamados de um mesmo projeto, mesmo espalhados por classes diferentes.
 * Filtro vazio significa "todos" — nunca "nenhum".
 */
export function filtrarQuadro(chamados = [], { solicitanteId = '', cc = '' } = {}) {
  return chamados.filter((c) => {
    if (solicitanteId && c.solicitante_id !== solicitanteId) return false;
    if (cc && (c.cc || '') !== cc) return false;
    return true;
  });
}

/**
 * Opções dos filtros, montadas a partir do que está no quadro — não do cadastro
 * inteiro. Oferecer um CC que não tem chamado nenhum só gera lista vazia.
 */
export function opcoesDoQuadro(chamados = []) {
  const pessoas = new Map();
  const ccs = new Set();
  for (const c of chamados) {
    if (c.solicitante_id) pessoas.set(c.solicitante_id, c.solicitanteNome || 'Sem nome');
    if (c.cc) ccs.add(c.cc);
  }
  return {
    solicitantes: [...pessoas].map(([id, nome]) => ({ value: id, label: nome }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
    ccs: [...ccs].sort((a, b) => a.localeCompare(b, 'pt-BR')),
  };
}

/** Iniciais para o avatar do responsável no cartão. */
export function iniciais(nome) {
  const partes = (nome || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}
