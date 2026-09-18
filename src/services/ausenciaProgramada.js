import { supabase } from './supabase';

// ============================================================================
// Camada de dados da AUSÊNCIA PROGRAMADA (Gestão de Pessoas).
// Regras puras em src/config/ausenciaProgramada.js; banco em
// supabase/supabase_migration_ausencia_programada.sql.
//
// Leituras e escritas do colaborador e do gestor passam por RPC: as leituras
// trazem os nomes (o RH sem perfil admin não lê `colaboradores` inteiro), e as
// escritas devolvem erro legível em vez de um UPDATE barrado em silêncio.
// Só a edição de período (RH) é update direto, com `.select()` para detectar
// quando a RLS barrou.
// ============================================================================

// Disparado quando um pedido muda, para as outras telas abertas recarregarem.
export const AUSENCIA_EVENT = 'ausencias_programadas_atualizadas';
const avisar = () => window.dispatchEvent(new Event(AUSENCIA_EVENT));

function checar(error) {
  if (error) throw new Error(error.message || 'Falha ao falar com o banco.');
}

// escopo: 'meus' | 'equipe' | 'todos'
export async function listarPeriodos(escopo = 'meus') {
  const { data, error } = await supabase.rpc('ausencia_periodos_listar', { p_escopo: escopo });
  checar(error);
  return data || [];
}

// escopo: 'meus' | 'aprovar' | 'equipe' | 'todos'
export async function listarSolicitacoes(escopo = 'meus') {
  const { data, error } = await supabase.rpc('ausencia_solicitacoes_listar', { p_escopo: escopo });
  checar(error);
  return data || [];
}

export async function fetchMeuAprovador() {
  const { data, error } = await supabase.rpc('ausencia_meu_aprovador');
  checar(error);
  return (data || [])[0] || null;
}

export async function listarSemPeriodo() {
  const { data, error } = await supabase.rpc('ausencia_sem_periodo');
  checar(error);
  return data || [];
}

// Completa os períodos que faltam (os meus, de alguém ou de todos — RH).
// Best-effort ao abrir a tela: falha aqui não impede de mostrar o que já existe.
export async function gerarPeriodos({ colaboradorId = null, todos = false } = {}) {
  const { data, error } = await supabase.rpc('ausencia_gerar_periodos', {
    p_colaborador: colaboradorId,
    p_todos: todos,
  });
  checar(error);
  return data || 0;
}

// Alertas de vencimento (idempotente). Silencioso: é manutenção, não ação.
export async function gerarAlertas() {
  try {
    await supabase.rpc('ausencia_gerar_alertas');
  } catch {
    /* sem alerta hoje; a próxima abertura tenta de novo */
  }
}

export async function salvarPedido({ id = null, periodoId, inicio, fim, observacao = '', enviar = true }) {
  const { data, error } = await supabase.rpc('ausencia_salvar', {
    p_id: id,
    p_periodo: periodoId,
    p_inicio: inicio,
    p_fim: fim,
    p_observacao: observacao || null,
    p_enviar: enviar,
  });
  checar(error);
  avisar();
  return (data || [])[0] || null;
}

export async function excluirRascunho(id) {
  const { error } = await supabase.rpc('ausencia_excluir_rascunho', { p_id: id });
  checar(error);
  avisar();
}

export async function decidir(id, { aprovar, motivo = null }) {
  const { error } = await supabase.rpc('ausencia_decidir', {
    p_id: id,
    p_aprovar: aprovar,
    p_motivo: motivo,
  });
  checar(error);
  avisar();
}

export async function cancelar(id, { motivo = null } = {}) {
  const { error } = await supabase.rpc('ausencia_cancelar', { p_id: id, p_motivo: motivo });
  checar(error);
  avisar();
}

// RH: corrige um período (direito, ajuste com motivo, janela, observação).
export async function atualizarPeriodo(id, campos) {
  const { data, error } = await supabase
    .from('ausencia_periodos')
    .update(campos)
    .eq('id', id)
    .select('id');
  checar(error);
  if (!data?.length) throw new Error('Sem permissão para alterar este período.');
  avisar();
}

// RH: cadastra um período à mão (colaborador sem histórico).
export async function criarPeriodo(campos) {
  const { error } = await supabase
    .from('ausencia_periodos')
    .insert({ ...campos, origem: 'manual' });
  checar(error);
  avisar();
}
