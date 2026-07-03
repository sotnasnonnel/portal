// ===== Fluxo de aprovação de Requisições DP =====
// IDs fixos só do que ainda é fixo: o ADMIN que executa a etapa final.
// A cadeia de APROVAÇÃO agora é configurável pelo admin (tabela
// solicitacoes_rh_fluxos) — ver buscarFluxoGeral / montarEtapasDeConfig abaixo.
export const APROVADORES = {
  admin: 'c2318237-b3f7-49ec-bb48-9d2a0c0c555d', // Admin (DP) — executor final
};

// Mapeamento não segue o fluxo configurado do gestor: vai direto para aprovação
// do Lucas Ferraz (id verificado em colaboradores), e depois execução do DP.
export const APROVADOR_MAPEAMENTO = {
  id: '554ec9c1-c4fb-4b5a-b4a6-040c835acca5',
  nome: 'LUCAS FERRAZ GONCALVES',
};

export const NOME_APROVADOR = {
  [APROVADORES.admin]: 'Admin (DP)',
};

export const nomeAprovador = (id) => NOME_APROVADOR[id] || 'Aprovador';

export const INICIATIVA_LABEL = {
  empresa: 'Iniciativa da Empresa',
  empregado: 'Iniciativa do Empregado',
};

export const TIPO_LABEL = {
  aumento_salario: 'Alteração de Cargo / Função',
  desligamento: 'Desligamento',
  formulario_contratacao: 'Formulário de Contratação',
  mapeamento: 'Mapeamento',
  ajuda_custo: 'Ajuda de Custo',
  nova_vaga: 'Nova Vaga',
};

// Rótulos curtos para chips de filtro (o label completo da Alteração é longo demais).
export const TIPO_LABEL_CURTO = {
  aumento_salario: 'Alteração',
  desligamento: 'Desligamento',
  formulario_contratacao: 'Contratação',
  mapeamento: 'Mapeamento',
  ajuda_custo: 'Ajuda de Custo',
  nova_vaga: 'Nova Vaga',
};

// Tipos de requisição que têm fluxo de aprovação próprio (ordem de exibição).
export const TIPOS_FLUXO = [
  'aumento_salario', 'desligamento', 'formulario_contratacao',
  'ajuda_custo', 'nova_vaga', 'mapeamento',
];

// Fluxo geral por gestor: reaproveita a linha legada (tipo='aumento_salario', iniciativa='')
// de solicitacoes_rh_fluxos como a ÚNICA cadeia de aprovação, válida para todas as requisições.
export const FLUXO_GERAL = { tipo: 'aumento_salario', iniciativa: '' };

// Normaliza iniciativa para a convenção do banco (nunca null).
export const normIniciativa = (ini) => (ini === 'empresa' || ini === 'empregado' ? ini : '');

/**
 * Busca o fluxo GERAL do solicitante (única cadeia, vale p/ todas as requisições).
 * Retorna { fluxo, erro }:
 *  - fluxo: a linha de solicitacoes_rh_fluxos (slot FLUXO_GERAL), ou null se não configurada.
 *  - erro:  objeto de erro do Supabase (≠ "não configurado") ou null.
 * Distinguir erro de "não encontrado" é essencial: erro de rede NÃO deve
 * virar mensagem de "admin não configurou".
 */
export async function buscarFluxoGeral(supabase, solicitanteId) {
  const { data, error } = await supabase
    .from('solicitacoes_rh_fluxos')
    .select('*')
    .eq('solicitante_id', solicitanteId)
    .eq('tipo', FLUXO_GERAL.tipo)
    .eq('iniciativa', FLUXO_GERAL.iniciativa)
    .maybeSingle();
  if (error) return { fluxo: null, erro: error };
  return { fluxo: data || null, erro: null };
}

/**
 * Busca o fluxo de UM tipo do solicitante. Slot: (solicitante_id, tipo, iniciativa='').
 * Fallback (gestor ainda não seedado): 'mapeamento' → Lucas Ferraz; demais tipos →
 * slot geral (aumento_salario). Retorna { fluxo, erro } como buscarFluxoGeral.
 */
export async function buscarFluxoPorTipo(supabase, solicitanteId, tipo) {
  const { data, error } = await supabase
    .from('solicitacoes_rh_fluxos')
    .select('*')
    .eq('solicitante_id', solicitanteId)
    .eq('tipo', tipo)
    .eq('iniciativa', '')
    .maybeSingle();
  if (error) return { fluxo: null, erro: error };
  if (data) return { fluxo: data, erro: null };
  if (tipo === 'mapeamento') {
    return { fluxo: { aprovadores: [APROVADOR_MAPEAMENTO.id] }, erro: null };
  }
  if (tipo !== FLUXO_GERAL.tipo) {
    return buscarFluxoGeral(supabase, solicitanteId);
  }
  return { fluxo: null, erro: null };
}

/**
 * Monta as linhas de etapas a partir da cadeia configurada.
 * - aprovadores: array ORDENADO de colaborador_id (uuid em texto).
 * - nomePorId: mapa { id -> nome } para o snapshot do papel.
 * - criadorId: aplica auto-aprovação nas etapas cujo aprovador é o criador.
 * A etapa final de EXECUÇÃO é SEMPRE o admin (APROVADORES.admin) e é
 * acrescentada automaticamente (não vem da config).
 *
 * Lança erro se algum aprovador não tiver nome resolvido (evita gravar etapa
 * sem `papel`). Ids vazios/duplicados de espaço são descartados.
 */
export function montarEtapasDeConfig(solicitacaoId, aprovadores, criadorId, nomePorId) {
  const agora = new Date().toISOString();
  const ids = (Array.isArray(aprovadores) ? aprovadores : [])
    .map((x) => (typeof x === 'string' ? x.trim().toLowerCase() : ''))
    .filter(Boolean);

  const linhas = ids.map((id, i) => {
    const nome = nomePorId[id];
    if (!nome) {
      throw new Error(`Aprovador sem nome resolvido (id ${id}). Recarregue e tente de novo.`);
    }
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

  // Etapa final: execução pelo admin (sempre).
  linhas.push({
    solicitacao_id: solicitacaoId,
    ordem: ids.length + 1,
    aprovador_id: APROVADORES.admin,
    papel: 'Admin (execução)',
    tipo_etapa: 'execucao',
    status: 'pendente',
    decidido_em: null,
  });

  return linhas;
}

/** Etapa atual = primeira etapa de aprovação/execução ainda pendente (menor ordem). */
export function etapaAtual(etapas) {
  return (
    (etapas || [])
      .filter((e) => (e.tipo_etapa === 'aprovacao' || e.tipo_etapa === 'execucao') && e.status === 'pendente')
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))[0] || null
  );
}

/** Resumo textual do andamento, para exibir "por que está pendente". */
export function resumoAndamento(solicitacao, etapas) {
  const lista = etapas || [];
  // Prefere o nome "fotografado" na etapa (papel); cai em nomeAprovador como fallback.
  const nomeDe = (etapa) => etapa?.papel || nomeAprovador(etapa?.aprovador_id);
  if (solicitacao.status === 'reprovada') {
    const rep = lista.find((e) => e.status === 'reprovada');
    return { texto: `Reprovada por ${nomeDe(rep)}`, tom: 'reprovada' };
  }
  if (solicitacao.status === 'concluida') {
    return { texto: 'Concluída / Executada', tom: 'concluida' };
  }
  const atual = etapaAtual(etapas);
  if (!atual) return { texto: 'Em andamento', tom: 'pendente' };
  const verbo = atual.tipo_etapa === 'execucao' ? 'execução de' : 'aprovação de';
  return { texto: `Aguardando ${verbo} ${nomeDe(atual)}`, tom: 'pendente' };
}

/** O usuário pode agir AGORA nesta solicitação? Retorna 'aprovacao' | 'execucao' | null. */
export function acaoDisponivel(userId, etapas = []) {
  const atual = etapaAtual(etapas);
  if (atual && atual.aprovador_id === userId) return atual.tipo_etapa;
  return null;
}

/**
 * Reconcilia as etapas de UMA requisição pendente com um molde novo.
 * Preserva as etapas já decididas (status != 'pendente') e substitui só o
 * trecho pendente pela parte do molde que ainda não agiu ("substitui o que
 * falta"). A execução do Admin entra sempre por último.
 *
 * Puro (sem I/O). `agora` é injetado para testabilidade.
 * Contrato: nomePorId pode ter chaves em qualquer caixa; são normalizadas.
 * Rows de `inserir` NÃO trazem solicitacao_id — o chamador injeta.
 */
export function reconciliarEtapas(etapasAtuais, moldeIds, nomePorId, criadorId, agora) {
  const norm = (x) => (typeof x === 'string' ? x.trim().toLowerCase() : '');
  const lista = Array.isArray(etapasAtuais) ? etapasAtuais : [];

  const nomeNorm = {};
  for (const [k, v] of Object.entries(nomePorId || {})) nomeNorm[norm(k)] = v;

  const mantidas = lista
    .filter((e) => e.status !== 'pendente')
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  const pendentes = lista
    .filter((e) => e.status === 'pendente')
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

  const idsDecididos = new Set(mantidas.map((e) => norm(e.aprovador_id)));
  const base = mantidas.reduce((m, e) => Math.max(m, e.ordem || 0), 0);
  const cri = norm(criadorId);

  const caudaIds = (Array.isArray(moldeIds) ? moldeIds : [])
    .map(norm)
    .filter(Boolean)
    .filter((id) => !idsDecididos.has(id));

  const novasAprovacoes = caudaIds.map((id, i) => {
    const nome = nomeNorm[id];
    if (!nome) throw new Error(`Aprovador sem nome resolvido (id ${id}).`);
    const auto = id === cri;
    return {
      ordem: base + i + 1,
      aprovador_id: id,
      papel: nome,
      tipo_etapa: 'aprovacao',
      status: auto ? 'auto_aprovada' : 'pendente',
      decidido_em: auto ? agora : null,
    };
  });

  const execucao = {
    ordem: base + caudaIds.length + 1,
    aprovador_id: APROVADORES.admin,
    papel: 'Admin (execução)',
    tipo_etapa: 'execucao',
    status: 'pendente',
    decidido_em: null,
  };

  const inserir = [...novasAprovacoes, execucao];

  const key = (e) => `${norm(e.aprovador_id)}|${e.tipo_etapa}|${e.status}`;
  const semMudanca = pendentes.map(key).join(',') === inserir.map(key).join(',');

  return { semMudanca, apagarIds: pendentes.map((e) => e.id), inserir };
}

/**
 * Aplica o molde novo às requisições PENDENTES de um gestor+tipo.
 * Usa reconciliarEtapas por requisição; nas que mudaram, apaga as etapas
 * pendentes e insere as novas. Nunca toca em etapas decididas.
 * Retorna quantas requisições foram atualizadas.
 */
export async function resincronizarPendentes(supabase, { solicitanteId, tipo, moldeIds, nomePorId, agora }) {
  const { data: sols, error } = await supabase
    .from('solicitacoes_rh')
    .select('id, etapas:solicitacoes_rh_etapas(id, ordem, aprovador_id, papel, tipo_etapa, status)')
    .eq('gestor_id', solicitanteId)
    .eq('tipo', tipo)
    .eq('status', 'pendente');
  if (error) throw error;

  let atualizadas = 0;
  for (const sol of sols || []) {
    const { semMudanca, inserir } = reconciliarEtapas(sol.etapas, moldeIds, nomePorId, solicitanteId, agora);
    if (semMudanca) continue;

    const { error: eDel } = await supabase
      .from('solicitacoes_rh_etapas')
      .delete()
      .eq('solicitacao_id', sol.id)
      .eq('status', 'pendente');
    if (eDel) throw eDel;

    const rows = inserir.map((r) => ({ ...r, solicitacao_id: sol.id }));
    const { error: eIns } = await supabase.from('solicitacoes_rh_etapas').insert(rows);
    if (eIns) throw eIns;

    atualizadas += 1;
  }
  return atualizadas;
}
