import { supabase } from './supabase';

// ============================================================================
// Camada de dados da FOLGA DE CAMPO. Regras puras em src/config/folgaCampo.js;
// banco em supabase/supabase_migration_folga_campo.sql.
//
// Tudo passa por RPC: a leitura traz os nomes já resolvidos (o RH sem perfil
// admin não lê `colaboradores` inteiro pela RLS) e a escrita devolve erro
// legível em vez de um UPDATE barrado em silêncio.
// ============================================================================

// Disparado quando um registro muda, para as outras telas abertas recarregarem.
export const FOLGA_CAMPO_EVENT = 'folgas_campo_atualizadas';
const avisar = () => window.dispatchEvent(new Event(FOLGA_CAMPO_EVENT));

function checar(error) {
  if (error) throw new Error(error.message || 'Falha ao falar com o banco.');
}

// escopo: 'meus' | 'aprovar' | 'equipe' | 'todos'
export async function listar(escopo = 'meus') {
  const { data, error } = await supabase.rpc('folga_campo_listar', { p_escopo: escopo });
  checar(error);
  return data || [];
}

export async function fetchMeuAprovador() {
  const { data, error } = await supabase.rpc('folga_campo_meu_aprovador');
  checar(error);
  return (data || [])[0] || null;
}

export async function registrar({ inicio, fim, motivo, obra = '' }) {
  const { data, error } = await supabase.rpc('folga_campo_registrar', {
    p_inicio: inicio,
    p_fim: fim,
    p_motivo: motivo,
    p_obra: obra || null,
  });
  checar(error);
  avisar();
  return (data || [])[0] || null;
}

export async function decidir(id, { aprovar, motivo = null }) {
  const { error } = await supabase.rpc('folga_campo_decidir', {
    p_id: id,
    p_aprovar: aprovar,
    p_motivo: motivo,
  });
  checar(error);
  avisar();
}

export async function cancelar(id, { motivo = null } = {}) {
  const { error } = await supabase.rpc('folga_campo_cancelar', { p_id: id, p_motivo: motivo });
  checar(error);
  avisar();
}
