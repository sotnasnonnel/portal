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

/**
 * Filtros da fila de atendimento.
 *
 * Assunto é busca por texto, sem acento e sem caixa — quem digita "uber" quer
 * achar "Solicitação de viagem Uber". Os demais são igualdade exata.
 *
 * `criadoDe`/`criadoAte` são datas de <input type="date"> ("2026-08-21"). A
 * comparação é feita sobre os 10 primeiros caracteres do ISO, não convertendo
 * para Date: `new Date('2026-08-21')` é UTC e, no nosso fuso, jogaria o
 * chamado aberto de manhã para o dia anterior.
 */
const semAcento = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function filtrarFila(chamados = [], f = {}) {
  const termo = semAcento(f.assunto).trim();
  return chamados.filter((c) => {
    if (termo && !semAcento(c.assunto).includes(termo)) return false;
    if (f.status && c.status !== f.status) return false;
    if (f.solicitanteId && c.solicitante_id !== f.solicitanteId) return false;
    // '' no filtro = "todos"; 'sem' = os que ninguém assumiu ainda.
    if (f.atendenteId === 'sem' && c.atendente_id) return false;
    if (f.atendenteId && f.atendenteId !== 'sem' && c.atendente_id !== f.atendenteId) return false;
    const dia = (c.criado_em || '').slice(0, 10);
    if (f.criadoDe && dia < f.criadoDe) return false;
    if (f.criadoAte && dia > f.criadoAte) return false;
    return true;
  });
}

/**
 * Opções dos filtros, montadas do que está NA FILA — não do cadastro inteiro.
 * Oferecer um responsável sem chamado nenhum só gera lista vazia.
 */
export function opcoesDaFila(chamados = []) {
  const solicitantes = new Map();
  const responsaveis = new Map();
  const status = new Set();
  for (const c of chamados) {
    if (c.solicitante_id) solicitantes.set(c.solicitante_id, c.solicitanteNome || 'Sem nome');
    if (c.atendente_id) responsaveis.set(c.atendente_id, c.atendenteNome || 'Sem nome');
    if (c.status) status.add(c.status);
  }
  const lista = (m) => [...m].map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  return {
    solicitantes: lista(solicitantes),
    responsaveis: lista(responsaveis),
    status: [...status].sort(),
    // Só oferece "sem responsável" quando existe algum — filtro que nunca
    // devolve nada é ruído na tela.
    temSemResponsavel: chamados.some((c) => !c.atendente_id),
  };
}
