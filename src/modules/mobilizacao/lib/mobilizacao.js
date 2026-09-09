import { supabase } from '../../../services/supabase';

/**
 * Única camada de acesso ao Supabase da Mobilização. Nenhuma página fala com o
 * banco direto — regra do portal, e aqui ela paga mais caro do que de costume:
 * o encadeamento de prazos mora em gatilho, e uma tela gravando por fora
 * silenciaria o recálculo.
 *
 * O que este módulo NÃO faz de propósito:
 *   - não calcula data prevista (é do banco, app_private.mob_recalcular);
 *   - não cria processo com inserts soltos (é a RPC mobilizacao_abrir, numa
 *     transação — o Adm já paga o preço do contrário em
 *     criarMobilizacaoComAdicionais);
 *   - não escreve histórico (só os gatilhos escrevem em mobilizacao_eventos).
 */

// UPDATE barrado pela RLS não dá erro, dá zero linhas — por isso todo update
// abaixo confere o retorno em vez de confiar na ausência de erro.
const exigirLinha = (data, erro, mensagem) => {
  if (erro) throw new Error(`${mensagem}: ${erro.message}`);
  if (!data?.length) throw new Error(`${mensagem}: você não tem permissão para esta ação.`);
};

/**
 * Nomes de pessoas por RPC.
 *
 * A policy `colaboradores_select` só libera a própria linha, a equipe e o admin
 * do DP — o responsável de uma etapa quase nunca é subordinado de quem está
 * olhando, e a coluna viria vazia. Uma chamada para a lista inteira, e não uma
 * por linha.
 */
async function nomesDe(ids = []) {
  const unicos = [...new Set(ids.filter(Boolean))];
  if (!unicos.length) return new Map();
  const { data } = await supabase.rpc('nomes_colaboradores', { p_ids: unicos });
  return new Map((data || []).map((p) => [p.id, p.nome]));
}

/**
 * Quem pode ser responsável por uma etapa.
 *
 * Reusa a RPC do Adm de propósito: o time é o mesmo, e uma segunda lista
 * divergiria na primeira contratação. Ela devolve (id, nome, papel) — só as
 * duas primeiras interessam aqui.
 *
 * A RPC estava só no Supabase, sem migração no repositório; foi versionada em
 * supabase/supabase_migration_chamados_adm_time.sql quando este módulo passou a
 * ser o segundo a depender dela.
 */
export async function listarTime() {
  const { data, error } = await supabase.rpc('chamados_adm_time');
  if (error) throw new Error(`Não foi possível carregar o time: ${error.message}`);
  return data || [];
}

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

export async function listarCatalogo() {
  const { data, error } = await supabase
    .from('mobilizacao_catalogo_etapas')
    .select('id, fluxo, codigo, ordem, titulo, descricao, depende_de, sla_dias_uteis, responsavel_id, responsavel_papel, obrigatoria, condicao, ativo')
    .order('fluxo')
    .order('ordem');
  if (error) throw new Error(`Não foi possível carregar o catálogo: ${error.message}`);
  return data || [];
}

/**
 * Grava uma etapa do catálogo. Upsert por (fluxo, codigo) para a tela poder
 * salvar linha a linha sem se importar se ela já existia.
 */
export async function salvarEtapaCatalogo(etapa) {
  const { data, error } = await supabase
    .from('mobilizacao_catalogo_etapas')
    .upsert({
      fluxo: etapa.fluxo,
      codigo: etapa.codigo,
      ordem: Number(etapa.ordem) || 0,
      titulo: etapa.titulo,
      descricao: etapa.descricao || null,
      depende_de: etapa.depende_de || null,
      sla_dias_uteis: etapa.sla_dias_uteis === '' || etapa.sla_dias_uteis === null
        ? null : Number(etapa.sla_dias_uteis),
      responsavel_id: etapa.responsavel_id || null,
      responsavel_papel: etapa.responsavel_papel || null,
      obrigatoria: etapa.obrigatoria !== false,
      condicao: etapa.condicao || {},
      ativo: etapa.ativo !== false,
    }, { onConflict: 'fluxo,codigo' })
    .select('id');
  exigirLinha(data, error, 'Não foi possível salvar a etapa');
}

/**
 * Desativa em vez de apagar. Excluir a linha quebraria o `catalogo_id` das
 * etapas já instanciadas e faria sumir do histórico um passo que aconteceu.
 */
export async function desativarEtapaCatalogo(id) {
  const { data, error } = await supabase
    .from('mobilizacao_catalogo_etapas')
    .update({ ativo: false })
    .eq('id', id)
    .select('id');
  exigirLinha(data, error, 'Não foi possível desativar a etapa');
}

// ---------------------------------------------------------------------------
// Processos
// ---------------------------------------------------------------------------

const CAMPOS_PROCESSO = `
  id, numero, fluxo, titulo, status, profissional_id, profissional_nome,
  empresa_phd, cliente_phd, cliente_final, local_obra, cod_ct, cod_phd,
  coo_phd, ger_phd, contrato, data_base, observacoes,
  solicitante_id, responsavel_id, origem, origem_chamado_id,
  prazo_em, etapas_total, etapas_concluidas, criado_em, concluido_em
`;

/**
 * Abre um processo. `origem` é 'manual' aqui sempre: os de pessoa nascem pelo
 * gatilho do chamado do Adm, e um caminho paralelo pela tela criaria dois
 * processos para a mesma mobilização.
 */
export async function abrirProcesso(fluxo, dados) {
  const { data, error } = await supabase.rpc('mobilizacao_abrir', {
    p_fluxo: fluxo,
    p_dados: dados,
  });
  if (error) throw new Error(`Não foi possível abrir o processo: ${error.message}`);
  return data;
}

/**
 * Lista de processos, já com o nome do responsável.
 *
 * `apenasAbertos` é o padrão porque a lista existe para responder "o que está
 * rodando"; o histórico inteiro tem 2026 anos de planilha atrás e só interessa
 * quando alguém procura por ele.
 */
export async function listarProcessos({ apenasAbertos = true, fluxo = '' } = {}) {
  let q = supabase.from('mobilizacao_processos').select(CAMPOS_PROCESSO);
  if (apenasAbertos) q = q.eq('status', 'em_andamento');
  if (fluxo) q = q.eq('fluxo', fluxo);

  const { data, error } = await q.order('criado_em', { ascending: false });
  if (error) throw new Error(`Não foi possível carregar os processos: ${error.message}`);

  const lista = data || [];
  const nomes = await nomesDe(lista.map((p) => p.responsavel_id));
  return lista.map((p) => ({ ...p, responsavelNome: nomes.get(p.responsavel_id) || '' }));
}

export async function buscarProcesso(id) {
  const { data, error } = await supabase
    .from('mobilizacao_processos')
    .select(CAMPOS_PROCESSO)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`Não foi possível abrir o processo: ${error.message}`);
  if (!data) throw new Error('Processo não encontrado — ou você não tem acesso a ele.');

  const nomes = await nomesDe([data.responsavel_id, data.solicitante_id]);
  return {
    ...data,
    responsavelNome: nomes.get(data.responsavel_id) || '',
    solicitanteNome: nomes.get(data.solicitante_id) || '',
  };
}

/** Muda a data-base. O gatilho reprojeta as etapas que ainda não aconteceram. */
export async function definirDataBase(processoId, dataBase) {
  const { data, error } = await supabase
    .from('mobilizacao_processos')
    .update({ data_base: dataBase || null })
    .eq('id', processoId)
    .select('id');
  exigirLinha(data, error, 'Não foi possível mudar a data-base');
}

export async function definirResponsavelProcesso(processoId, responsavelId) {
  const { data, error } = await supabase
    .from('mobilizacao_processos')
    .update({ responsavel_id: responsavelId || null })
    .eq('id', processoId)
    .select('id');
  exigirLinha(data, error, 'Não foi possível trocar o responsável do processo');
}

export async function cancelarProcesso(processoId, motivo) {
  const { error } = await supabase.rpc('mobilizacao_cancelar', {
    p_processo: processoId,
    p_motivo: motivo || null,
  });
  if (error) throw new Error(`Não foi possível cancelar o processo: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Etapas
// ---------------------------------------------------------------------------

/**
 * Le a consulta INTEIRA, em paginas.
 *
 * O PostgREST corta a resposta em 1000 linhas e nao avisa: vem 1000, sem erro e
 * sem sinal de que havia mais. Em 08/09/2026 isso fazia a lista de Etapas da
 * Torre mostrar 7 das 25 etapas vencidas — o resto era cortado depois da
 * ordenacao, e ninguem tinha como perceber, porque a tela dizia "1000 etapas" e
 * 1000 etapas apareciam.
 *
 * Por que paginar em vez de filtrar mais: quem chama e que sabe o recorte, e um
 * limite implicito no meio do caminho volta a morder assim que a tabela crescer
 * de novo. Aqui o contrato passa a ser "veio tudo".
 */
async function lerTudo(montarQuery, { pagina = 1000 } = {}) {
  const linhas = [];
  for (let de = 0; ; de += pagina) {
    const { data, error } = await montarQuery().range(de, de + pagina - 1);
    if (error) return { data: null, error };
    linhas.push(...(data || []));
    if (!data || data.length < pagina) return { data: linhas, error: null };
  }
}

const CAMPOS_ETAPA = `
  id, processo_id, codigo, ordem, titulo, descricao, depende_de, sla_dias_uteis,
  responsavel_id, status, data_prevista, data_real, dias_atraso, observacao,
  tocada_no_portal, updated_at
`;

/** As etapas de um processo, na ordem do passo a passo. */
export async function listarEtapasDoProcesso(processoId) {
  const { data, error } = await supabase
    .from('mobilizacao_etapas')
    .select(CAMPOS_ETAPA)
    .eq('processo_id', processoId)
    .order('ordem');
  if (error) throw new Error(`Não foi possível carregar as etapas: ${error.message}`);

  const lista = data || [];
  const nomes = await nomesDe(lista.map((e) => e.responsavel_id));
  return lista.map((e) => ({ ...e, responsavelNome: nomes.get(e.responsavel_id) || '' }));
}

/**
 * As etapas do QUADRO e da FILA, com o processo embutido em cada uma.
 *
 * O cartão é a etapa, mas ninguém trabalha uma etapa sem saber de quem ela é —
 * daí o join. A janela de 15 dias para as concluídas é a mesma do quadro do
 * Adm: encerrado antigo não é o que se olha, e sem o corte o quadro cresce para
 * sempre.
 */
export async function listarEtapasDoQuadro({ diasConcluidas = 15, fluxo = '' } = {}) {
  const corte = new Date(Date.now() - diasConcluidas * 86400000).toISOString();

  // Funcao, e nao um objeto de query: lerTudo remonta a consulta a cada pagina,
  // porque o cliente do Supabase e encadeavel mas nao reutilizavel — chamar
  // .range() duas vezes no mesmo objeto acumula os dois.
  const montar = () => {
    let q = supabase
      .from('mobilizacao_etapas')
      .select(`${CAMPOS_ETAPA}, processo:mobilizacao_processos!inner(id, numero, fluxo, titulo, status, profissional_nome, cliente_phd, cod_ct, local_obra)`)
      .neq('processo.status', 'cancelado')
      // O valor vai entre aspas porque o ISO tem pontos e dois-pontos, que são
      // separadores na sintaxe de filtro do PostgREST.
      .or(`status.neq.concluida,updated_at.gte."${corte}"`)
      .order('data_prevista', { nullsFirst: false })
      // Desempate estavel: sem ele, duas etapas com a mesma data_prevista podem
      // trocar de lugar entre uma pagina e a seguinte, e uma delas se perde.
      .order('id');
    if (fluxo) q = q.eq('processo.fluxo', fluxo);
    return q;
  };

  const { data, error } = await lerTudo(montar);
  if (error) throw new Error(`Não foi possível carregar o quadro: ${error.message}`);

  const lista = data || [];
  const nomes = await nomesDe(lista.map((e) => e.responsavel_id));
  return lista.map((e) => ({
    ...e,
    responsavelNome: nomes.get(e.responsavel_id) || '',
    // Achatado no próprio objeto: os filtros e o cartão são código puro, e
    // fazê-los andar por `e.processo?.x` espalharia optional chaining por tudo.
    numero: e.processo?.numero,
    fluxo: e.processo?.fluxo,
    processoTitulo: e.processo?.titulo,
    processoStatus: e.processo?.status,
    cc: e.processo?.cod_ct || '',
  }));
}


/**
 * Move a etapa de coluna.
 *
 * Grava SÓ o status. `data_real`, o prazo das etapas dependentes, o progresso
 * do processo e o evento no histórico saem do gatilho — se qualquer um deles
 * viesse daqui, uma segunda tela amanhã esqueceria de fazê-lo.
 */
export async function moverEtapa(etapaId, status) {
  const { data, error } = await supabase
    .from('mobilizacao_etapas')
    .update({ status })
    .eq('id', etapaId)
    .select('id, status, data_prevista, data_real, dias_atraso');
  exigirLinha(data, error, 'Não foi possível mover a etapa');
  return data[0];
}

/** O responsável puxa a etapa para si. Mesma gravação de `definirResponsavelEtapa`. */
export async function assumirEtapa(etapaId, meuId) {
  return definirResponsavelEtapa(etapaId, meuId, 'Não foi possível assumir a etapa');
}

/**
 * Troca o responsável pela etapa. `responsavelId` nulo devolve a etapa à fila
 * sem dono — que é um estado legítimo e que o quadro destaca.
 *
 * Mesma gravação de `assumirEtapa`; o que muda é a mensagem quando a RLS
 * recusa. O histórico registra a troca sozinho, por gatilho.
 */
export async function definirResponsavelEtapa(etapaId, responsavelId, msg = 'Não foi possível trocar o responsável') {
  const { data, error } = await supabase
    .from('mobilizacao_etapas')
    .update({ responsavel_id: responsavelId || null })
    .eq('id', etapaId)
    .select('id');
  exigirLinha(data, error, msg);
}

/** Data real informada à mão — a etapa que aconteceu ontem e ninguém marcou. */
export async function definirDataReal(etapaId, dataReal) {
  const { data, error } = await supabase
    .from('mobilizacao_etapas')
    .update({ data_real: dataReal || null })
    .eq('id', etapaId)
    .select('id, data_real');
  exigirLinha(data, error, 'Não foi possível gravar a data');
}

export async function salvarObservacaoEtapa(etapaId, observacao) {
  const { data, error } = await supabase
    .from('mobilizacao_etapas')
    .update({ observacao: observacao?.trim() || null })
    .eq('id', etapaId)
    .select('id');
  exigirLinha(data, error, 'Não foi possível salvar a observação');
}

// ---------------------------------------------------------------------------
// Histórico e indicadores
// ---------------------------------------------------------------------------

export async function listarEventos(processoId) {
  const { data, error } = await supabase
    .from('mobilizacao_eventos')
    .select('id, etapa_id, tipo, autor_id, de, para, dados, created_at')
    .eq('processo_id', processoId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Não foi possível carregar o histórico: ${error.message}`);

  const lista = data || [];
  // `de`/`para` guardam ora status, ora id de pessoa (evento 'atribuido'), e o
  // banco não tem como saber a diferença. Quem resolve é quem lê.
  const ids = lista.flatMap((e) => [e.autor_id, ehUuid(e.de) ? e.de : null, ehUuid(e.para) ? e.para : null]);
  const nomes = await nomesDe(ids);
  return lista.map((e) => ({
    ...e,
    autorNome: nomes.get(e.autor_id) || '',
    deNome: ehUuid(e.de) ? (nomes.get(e.de) || '—') : e.de,
    paraNome: ehUuid(e.para) ? (nomes.get(e.para) || '—') : e.para,
  }));
}

const ehUuid = (v) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);

/**
 * Carga dos indicadores. Um select cru, sem filtro — o recorte é da RLS, então
 * cada um vê o que lhe cabe. Mesma escolha do painel do Adm.
 */
export async function listarParaIndicadores() {
  const [etapas, processos] = await Promise.all([
    supabase
      .from('mobilizacao_etapas')
      .select('id, processo_id, codigo, titulo, status, dias_atraso, data_prevista, responsavel_id, processo:mobilizacao_processos!inner(numero, titulo, fluxo, status)'),
    supabase.from('mobilizacao_processos').select('id, numero, titulo, fluxo, status, prazo_em'),
  ]);
  if (etapas.error) throw new Error(`Não foi possível carregar os indicadores: ${etapas.error.message}`);
  if (processos.error) throw new Error(`Não foi possível carregar os indicadores: ${processos.error.message}`);

  const lista = etapas.data || [];
  const nomes = await nomesDe(lista.map((e) => e.responsavel_id));
  return {
    etapas: lista.map((e) => ({
      ...e,
      fluxo: e.processo?.fluxo,
      processoNumero: e.processo?.numero,
      processoTitulo: e.processo?.titulo,
      responsavelNome: nomes.get(e.responsavel_id) || '',
    })),
    processos: processos.data || [],
  };
}


/**
 * Falhas do gatilho do Adm.
 *
 * O gatilho engole o erro para nunca impedir a abertura de um chamado — o preço
 * é que a falha precisa aparecer em ALGUM lugar, senão o processo simplesmente
 * não existe e ninguém percebe.
 */
export async function listarFalhasGatilho() {
  const { data, error } = await supabase
    .from('mobilizacao_gatilho_falhas')
    .select('id, chamado_id, erro, created_at')
    .is('resolvido_em', null)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(`Não foi possível carregar as falhas: ${error.message}`);
  return data || [];
}

export async function reprocessarChamado(chamadoId) {
  const { data, error } = await supabase.rpc('mobilizacao_reprocessar_chamado', { p_chamado: chamadoId });
  if (error) throw new Error(`Não foi possível reprocessar: ${error.message}`);
  return data;
}

/**
 * O processo nascido de um chamado do Adm — para a tela do chamado mostrar
 * "Processo de mobilização #N, 4 de 11 passos".
 *
 * Devolve null em vez de lançar: a ausência é o caso normal (todo chamado que
 * não é de mobilização), e um erro aqui não pode atrapalhar a tela do chamado.
 */
export async function processoDoChamado(chamadoId) {
  const { data, error } = await supabase
    .from('mobilizacao_processos')
    .select('id, numero, fluxo, status, etapas_total, etapas_concluidas, prazo_em')
    .eq('origem_chamado_id', chamadoId)
    .maybeSingle();
  if (error) return null;
  return data || null;
}
