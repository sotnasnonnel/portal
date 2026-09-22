import { supabase } from './supabase';
import { notificarAusencia } from './notificarAusencia';

// ============================================================================
// Camada de dados da AUSÊNCIA PROGRAMADA e da FOLGA DE CAMPO (Gestão de
// Pessoas). As duas são a mesma rotina em tabelas separadas, então o serviço é
// um só, montado a partir do descritor do módulo (config/modulosAusencia.js):
// `mod.rpc` é o prefixo das funções no banco e `mod.tabelaPeriodos` a única
// tabela escrita direto.
//
// Regras puras em src/config/ausenciaProgramada.js; banco em
// supabase/supabase_migration_ausencia_programada.sql e
// supabase/supabase_migration_folga_campo.sql.
//
// Leituras e escritas do colaborador e do gestor passam por RPC: as leituras
// trazem os nomes (o RH sem perfil admin não lê `colaboradores` inteiro), e as
// escritas devolvem erro legível em vez de um UPDATE barrado em silêncio.
// Só a edição de período (RH) é update direto, com `.select()` para detectar
// quando a RLS barrou.
// ============================================================================

function checar(error) {
  if (error) throw new Error(error.message || 'Falha ao falar com o banco.');
}

// Um serviço por módulo, criado uma vez: as telas chamam servicoAusencia(mod)
// no corpo do componente e não podem receber um objeto novo a cada render
// (ele entra nas dependências dos useCallback/useEffect).
const cache = new Map();

export function servicoAusencia(mod) {
  if (!cache.has(mod.chave)) cache.set(mod.chave, montar(mod));
  return cache.get(mod.chave);
}

function montar(mod) {
  const fn = (sufixo) => `${mod.rpc}_${sufixo}`;
  // Disparado quando um pedido muda, para as outras telas abertas recarregarem.
  const avisar = () => window.dispatchEvent(new Event(mod.evento));

  // escopo: 'meus' | 'equipe' | 'todos'
  async function listarPeriodos(escopo = 'meus') {
    const { data, error } = await supabase.rpc(fn('periodos_listar'), { p_escopo: escopo });
    checar(error);
    return data || [];
  }

  // escopo: 'meus' | 'aprovar' | 'equipe' | 'todos'
  async function listarSolicitacoes(escopo = 'meus') {
    const { data, error } = await supabase.rpc(fn('solicitacoes_listar'), { p_escopo: escopo });
    checar(error);
    return data || [];
  }

  async function fetchMeuAprovador() {
    const { data, error } = await supabase.rpc(fn('meu_aprovador'));
    checar(error);
    return (data || [])[0] || null;
  }

  async function listarSemPeriodo() {
    const { data, error } = await supabase.rpc(fn('sem_periodo'));
    checar(error);
    return data || [];
  }

  // Completa os períodos que faltam (os meus, de alguém ou de todos — RH).
  // Best-effort ao abrir a tela: falha aqui não impede de mostrar o que já existe.
  async function gerarPeriodos({ colaboradorId = null, todos = false } = {}) {
    const { data, error } = await supabase.rpc(fn('gerar_periodos'), {
      p_colaborador: colaboradorId,
      p_todos: todos,
    });
    checar(error);
    return data || 0;
  }

  // Alertas de vencimento (idempotente). Silencioso: é manutenção, não ação.
  async function gerarAlertas() {
    try {
      await supabase.rpc(fn('gerar_alertas'));
    } catch {
      /* sem alerta hoje; a próxima abertura tenta de novo */
    }
  }

  async function salvarPedido({ id = null, periodoId, inicio, fim, observacao = '', enviar = true }) {
    const { data, error } = await supabase.rpc(fn('salvar'), {
      p_id: id,
      p_periodo: periodoId,
      p_inicio: inicio,
      p_fim: fim,
      p_observacao: observacao || null,
      p_enviar: enviar,
    });
    checar(error);
    avisar();
    const salvo = (data || [])[0] || null;
    // Só o ENVIO avisa o gestor: rascunho salvo não é pedido, e mandar e-mail a
    // cada salvamento treinaria o gestor a ignorar o aviso.
    if (enviar && salvo?.id) notificarAusencia(mod.chave, salvo.id, 'nova');
    return salvo;
  }

  async function excluirRascunho(id) {
    const { error } = await supabase.rpc(fn('excluir_rascunho'), { p_id: id });
    checar(error);
    avisar();
  }

  async function decidir(id, { aprovar, motivo = null }) {
    const { error } = await supabase.rpc(fn('decidir'), {
      p_id: id,
      p_aprovar: aprovar,
      p_motivo: motivo,
    });
    checar(error);
    avisar();
    // Vale para aprovado e reprovado: o colaborador precisa do desfecho, e no
    // reprovado o e-mail leva o motivo junto.
    notificarAusencia(mod.chave, id, 'decidida');
  }

  async function cancelar(id, { motivo = null } = {}) {
    const { error } = await supabase.rpc(fn('cancelar'), { p_id: id, p_motivo: motivo });
    checar(error);
    avisar();
  }

  // RH: corrige um período (direito, ajuste com motivo, janela, observação).
  async function atualizarPeriodo(id, campos) {
    const { data, error } = await supabase
      .from(mod.tabelaPeriodos)
      .update(campos)
      .eq('id', id)
      .select('id');
    checar(error);
    if (!data?.length) throw new Error('Sem permissão para alterar este período.');
    avisar();
  }

  // RH: cadastra um período à mão (colaborador sem histórico).
  async function criarPeriodo(campos) {
    const { error } = await supabase
      .from(mod.tabelaPeriodos)
      .insert({ ...campos, origem: 'manual' });
    checar(error);
    avisar();
  }

  return {
    evento: mod.evento,
    listarPeriodos,
    listarSolicitacoes,
    fetchMeuAprovador,
    listarSemPeriodo,
    gerarPeriodos,
    gerarAlertas,
    salvarPedido,
    excluirRascunho,
    decidir,
    cancelar,
    atualizarPeriodo,
    criarPeriodo,
  };
}
