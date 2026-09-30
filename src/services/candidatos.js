import { supabase } from './supabase';

// Candidatos — quem está em processo de contratação (pedido do André,
// 30/09/2026). Moram na própria tabela colaboradores, marcados `candidato` e
// inativos; ver supabase/supabase_migration_candidatos.sql para o porquê.

function checar(error) {
  if (error) throw new Error(error.message || 'Falha ao falar com o banco.');
}

export async function listarCandidatos() {
  const { data, error } = await supabase.rpc('candidatos_listar');
  checar(error);
  return data || [];
}

export async function salvarCandidato({ id = null, nome, funcao, formato, gestorId, previsao, obs }) {
  const { data, error } = await supabase.rpc('candidato_salvar', {
    p_id: id,
    p_nome: nome,
    p_funcao: funcao || null,
    p_formato: formato || null,
    p_gestor: gestorId || null,
    p_previsao: previsao || null,
    p_obs: obs || null,
  });
  checar(error);
  return data;
}

export async function promoverCandidato(id, { email, dataAdmissao, formato, perfil, funcao, superiorId }) {
  const { error } = await supabase.rpc('candidato_promover', {
    p_id: id,
    p_email: email,
    p_data_admissao: dataAdmissao,
    p_formato: formato,
    p_perfil: perfil || 'usuario',
    p_funcao: funcao || null,
    p_superior: superiorId || null,
  });
  checar(error);
}

/** 'apagado' (ninguém usou o nome) ou 'arquivado' (já há chamado no nome dele). */
export async function descartarCandidato(id) {
  const { data, error } = await supabase.rpc('candidato_descartar', { p_id: id });
  checar(error);
  return data;
}
