import { supabase } from './supabase';

// ============================================================================
// Camada de dados da Gestão de HORAS EXTRAS, compartilhada pelos DOIS módulos
// que usam a ferramenta: a Gestão de Horas (pedir, acompanhar, aprovar) e a
// Gestão de Pessoas (painel do DP, exceções de prazo, auditoria). As regras
// puras ficam em src/config/horasExtras.js.
// As LEITURAS passam por RPCs SECURITY DEFINER (horas_extras_listar,
// _auditoria_listar, _colaboradores) porque o DP — que é `rh_dp` sem ser admin —
// não lê `colaboradores` de toda a empresa pela RLS, e o painel dele precisa dos
// nomes. As ESCRITAS são updates diretos, gateados pela RLS (aprovador da
// solicitação ou DP). A auditoria é gravada por TRIGGER no banco: nenhuma tela
// precisa (nem pode) escrever nela.
// `minutos` é coluna gerada — nunca é enviada.
// ============================================================================

// ---- Solicitações ---------------------------------------------------------
export async function fetchSolicitacoes({ de = null, ate = null } = {}) {
  const { data, error } = await supabase.rpc('horas_extras_listar', { p_de: de, p_ate: ate });
  if (error) throw error;
  return data || [];
}

// Quem vai decidir a MINHA solicitação: o superior direto (ou o primeiro acima
// dele que esteja ativo e com login). null = ninguém acima resolve.
export async function fetchMeuAprovador() {
  const { data, error } = await supabase.rpc('horas_extras_meu_aprovador');
  if (error) throw error;
  return (data || [])[0] || null;
}

// Exceção de prazo que vale para mim nesta data/projeto (ou null).
export async function fetchExcecaoAplicavel({ data: dataHe, projetoId = null }) {
  if (!dataHe) return null;
  const { data, error } = await supabase.rpc('horas_extras_excecao_aplicavel', {
    p_data: dataHe,
    p_projeto: projetoId || null,
  });
  if (error) throw error;
  return (data || [])[0] || null;
}

export async function criarSolicitacao({
  colaboradorId,
  aprovadorId,
  gerenciaId,
  projetoId,
  cargo,
  matricula,
  centroCusto,
  dataHe,
  horaInicio,
  horaFim,
  motivo,
  justificativa,
  limiteHorario,
  excecaoId,
}) {
  const { data, error } = await supabase
    .from('horas_extras_solicitacoes')
    .insert({
      colaborador_id: colaboradorId,
      aprovador_id: aprovadorId || null,
      gerencia_id: gerenciaId || null,
      projeto_id: projetoId || null,
      cargo: cargo || null,
      matricula: matricula || null,
      centro_custo: centroCusto || null,
      data_he: dataHe,
      hora_inicio: horaInicio,
      hora_fim: horaFim,
      motivo,
      justificativa,
      limite_horario: limiteHorario || null,
      excecao_id: excecaoId || null,
    })
    .select('id, numero')
    .single();
  if (error) throw error;
  return data;
}

// Aprovação do gestor: define o DESTINO da hora. Banco de horas exige o previsto
// de compensação (data, período e quantidade), como no protótipo. O percentual
// não é informado aqui — é do DP/RM, conforme a CCT.
export async function aprovar(id, { destino, compensacao = null, observacao = '', decididoPor }) {
  const patch = {
    status: 'aprovada',
    destino,
    observacao_destino: observacao?.trim() || null,
    decidido_em: new Date().toISOString(),
    decidido_por: decididoPor,
    updated_at: new Date().toISOString(),
    compensacao_data: null,
    compensacao_periodo: null,
    compensacao_minutos: null,
  };
  if (destino === 'banco') {
    patch.compensacao_data = compensacao.data;
    patch.compensacao_periodo = compensacao.periodo;
    patch.compensacao_minutos = compensacao.minutos;
  }
  await atualizar(id, patch);
}

export async function reprovar(id, { motivo, decididoPor }) {
  await atualizar(id, {
    status: 'reprovada',
    motivo_reprovacao: motivo,
    decidido_em: new Date().toISOString(),
    decidido_por: decididoPor,
    updated_at: new Date().toISOString(),
  });
}

// DP: troca o destino depois da aprovação (sempre com motivo, que vai à auditoria).
export async function alterarDestino(id, { destino, compensacao = null, motivo }) {
  const patch = {
    destino,
    status: 'aprovada', // uma alteração de destino reabre o acompanhamento
    motivo_alteracao: motivo,
    updated_at: new Date().toISOString(),
    compensacao_data: null,
    compensacao_periodo: null,
    compensacao_minutos: null,
  };
  if (destino === 'banco') {
    patch.compensacao_data = compensacao.data;
    patch.compensacao_periodo = compensacao.periodo;
    patch.compensacao_minutos = compensacao.minutos;
  }
  await atualizar(id, patch);
}

export async function cancelar(id, { motivo }) {
  await atualizar(id, {
    status: 'cancelada',
    motivo_alteracao: motivo,
    updated_at: new Date().toISOString(),
  });
}

export async function marcarCompensada(id) {
  await atualizar(id, { status: 'compensada', updated_at: new Date().toISOString() });
}

// Quando a RLS barra um UPDATE, o Postgres não devolve erro: apenas nenhuma
// linha é afetada. Sem o `.select()`, a tela fecharia o modal dizendo "salvo"
// sem ter salvo nada. Pedimos a linha de volta e tratamos "0 linhas" como falha.
async function atualizar(id, patch) {
  const { data, error } = await supabase
    .from('horas_extras_solicitacoes')
    .update(patch)
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (!data?.length) {
    throw new Error(
      'Nada foi alterado: você não tem permissão para decidir esta solicitação (ou ela mudou de estado). Recarregue a página.'
    );
  }
}

// ---- Exceções de prazo (DP) ----------------------------------------------
export async function fetchExcecoes() {
  const { data, error } = await supabase
    .from('horas_extras_excecoes')
    .select('*')
    .order('criado_em', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function criarExcecao({
  tipo,
  novoHorario,
  dataInicial,
  dataFinal,
  colaboradorId,
  gerenciaId,
  projetoId,
  motivo,
  criadoPor,
}) {
  const { data, error } = await supabase
    .from('horas_extras_excecoes')
    .insert({
      tipo,
      novo_horario: novoHorario,
      data_inicial: dataInicial,
      data_final: dataFinal,
      // Cada escopo carrega só o seu alvo (a constraint do banco confere).
      colaborador_id: tipo === 'colaborador' || tipo === 'solicitacao' ? colaboradorId : null,
      gerencia_id: tipo === 'equipe' ? gerenciaId || null : null,
      projeto_id: tipo === 'equipe' ? projetoId || null : null,
      motivo,
      criado_por: criadoPor,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Mesmo cuidado do `atualizar`: RLS barrando um UPDATE não gera erro.
export async function setExcecaoAtiva(id, ativa) {
  const { data, error } = await supabase
    .from('horas_extras_excecoes')
    .update({ ativa })
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (!data?.length) {
    throw new Error('Nada foi alterado: você não tem permissão para editar exceções de prazo.');
  }
}

// ---- Auditoria (DP) -------------------------------------------------------
export async function fetchAuditoria({ limite = 300 } = {}) {
  const { data, error } = await supabase.rpc('horas_extras_auditoria_listar', { p_limite: limite });
  if (error) throw error;
  return data || [];
}

// ---- Apoio ----------------------------------------------------------------
// Colaboradores ativos (nome/id) para os selects da Central de Exceções. Só o DP.
export async function fetchColaboradoresDp() {
  const { data, error } = await supabase.rpc('horas_extras_colaboradores');
  if (error) throw error;
  return data || [];
}

// Última solicitação minha — usada só para pré-preencher matrícula e centro de
// custo, que não existem no cadastro de colaboradores.
export async function fetchUltimaMinha(colaboradorId) {
  const { data, error } = await supabase
    .from('horas_extras_solicitacoes')
    .select('matricula, centro_custo, projeto_id')
    .eq('colaborador_id', colaboradorId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}
