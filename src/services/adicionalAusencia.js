import { supabase } from './supabase';
import { OUTRO_PROJETO } from '../config/adicionalAusencia';

// Camada de dados do Adicional de Ausências. Tudo por RPC: as leituras trazem
// os nomes (quem aprova não lê `colaboradores` inteiro) e as escritas devolvem
// erro legível. Banco em supabase/supabase_migration_ausencia_adicionais.sql.

export const ADICIONAIS_EVENTO = 'adicionais_ausencia_atualizados';
const avisar = () => window.dispatchEvent(new Event(ADICIONAIS_EVENTO));

function checar(error) {
  if (error) throw new Error(error.message || 'Falha ao falar com o banco.');
}

/** p_escopo: 'meus' | 'aprovar' | 'todos' (RH). */
export async function listar(escopo = 'meus') {
  const { data, error } = await supabase.rpc('ausencia_adicional_listar', { p_escopo: escopo });
  checar(error);
  return data || [];
}

/** Para quem eu posso registrar: a minha equipe. */
export async function listarEquipe() {
  const { data, error } = await supabase.rpc('ausencia_adicional_equipe');
  checar(error);
  return data || [];
}

/** Projetos do portal (os mesmos do módulo Horas), sem os arquivados. */
export async function listarProjetos() {
  const { data, error } = await supabase
    .from('horas_projetos').select('id, nome, cliente').eq('arquivado', false).order('nome');
  checar(error);
  return data || [];
}

export async function registrar({ colaboradorId, projetoId, projetoNome, dias, observacao = '' }) {
  const daLista = projetoId && projetoId !== OUTRO_PROJETO;
  const { data, error } = await supabase.rpc('ausencia_adicional_registrar', {
    p_colaborador: colaboradorId,
    p_projeto_id: daLista ? projetoId : null,
    p_projeto_nome: daLista ? null : projetoNome,
    p_dias: Number(dias),
    p_observacao: observacao || null,
  });
  checar(error);
  avisar();
  return data?.[0] || null;
}

export async function decidir(id, { aprovar, motivo = null }) {
  const { error } = await supabase.rpc('ausencia_adicional_decidir', {
    p_id: id, p_aprovar: aprovar, p_motivo: motivo,
  });
  checar(error);
  avisar();
}

export async function cancelar(id, { motivo = null } = {}) {
  const { error } = await supabase.rpc('ausencia_adicional_cancelar', { p_id: id, p_motivo: motivo });
  checar(error);
  avisar();
}
