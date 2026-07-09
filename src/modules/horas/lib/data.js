import { supabase } from './supabase';

// ============================================================================
// Camada de dados do Controle de Horas (estilo Clockify).
// Pessoas vêm de `colaboradores`. Admin (perfil 'admin' / super-admin) gerencia
// projetos e vê o tempo de todos. `duracao_ms` é calculada no banco (coluna
// gerada) e o cronômetro em andamento é persistido em `horas_timer_ativo`.
// ============================================================================

// ---- Projetos -------------------------------------------------------------
export async function fetchProjetos({ incluirArquivados = false } = {}) {
  let q = supabase.from('horas_projetos').select('*').order('nome');
  if (!incluirArquivados) q = q.eq('arquivado', false);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createProjeto({ nome, cliente, cor }) {
  const { data, error } = await supabase
    .from('horas_projetos')
    .insert({ nome, cliente: cliente || null, cor: cor || '#C44A28' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProjeto(id, patch) {
  const { error } = await supabase.from('horas_projetos').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteProjeto(id) {
  const { error } = await supabase.from('horas_projetos').delete().eq('id', id);
  if (error) throw error;
}

// ---- Apontamentos ---------------------------------------------------------
// role 'admin' -> todos;  senão -> os próprios.
// Filtro por intervalo: sinceTs (início >=) e ateTs (início <=) — mantém o
// payload limitado (escala). A RLS ainda restringe ao escopo permitido.
export async function fetchApontamentos({ role, colaboradorId, sinceTs, ateTs } = {}) {
  let q = supabase.from('horas_apontamentos').select('*').order('inicio', { ascending: false });
  if (role !== 'admin') q = q.eq('colaborador_id', colaboradorId);
  if (sinceTs != null) q = q.gte('inicio', new Date(sinceTs).toISOString());
  if (ateTs != null) q = q.lt('inicio', new Date(ateTs).toISOString()); // ateTs = início do dia seguinte
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(normalizeApont);
}

// duracao_ms NÃO é enviada: o banco calcula (coluna gerada de fim - inicio).
export async function createApontamento({ colaboradorId, projetoId, descricao, inicioTs, fimTs }) {
  const { data, error } = await supabase
    .from('horas_apontamentos')
    .insert({
      colaborador_id: colaboradorId,
      projeto_id: projetoId || null,
      descricao: descricao || null,
      inicio: new Date(inicioTs).toISOString(),
      fim: new Date(fimTs).toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return normalizeApont(data);
}

export async function deleteApontamento(id) {
  const { error } = await supabase.from('horas_apontamentos').delete().eq('id', id);
  if (error) throw error;
}

// Colaboradores (id, nome, função) para as visões de admin: nomes nas tabelas e
// quebra "por função". Vem de uma RPC que devolve SÓ esses campos (nunca
// salário/senha) e apenas para admin do módulo — assim um admin do Horas que não
// é admin do portal também enxerga os nomes, sem expor dados sensíveis.
export async function fetchColaboradores() {
  const { data, error } = await supabase.rpc('horas_colaboradores');
  if (error) throw error;
  return data || [];
}

function normalizeApont(row) {
  return {
    id: row.id,
    colaboradorId: row.colaborador_id,
    projetoId: row.projeto_id,
    descricao: row.descricao || '',
    inicio: new Date(row.inicio).getTime(),
    fim: new Date(row.fim).getTime(),
    duracao: Number(row.duracao_ms) || 0,
  };
}

// ---------------------------------------------------------------------------
// Cronômetro em andamento — persistido no banco (horas_timer_ativo), 1 por
// colaborador. Segue em qualquer dispositivo. Persistimos o APONTAMENTO só ao
// encerrar (o timer vira uma linha em horas_apontamentos).
// ---------------------------------------------------------------------------
function normalizeTimer(row) {
  if (!row) return null;
  return {
    projetoId: row.projeto_id,
    descricao: row.descricao || '',
    inicio: new Date(row.inicio).getTime(),
  };
}

export async function fetchTimer(colaboradorId) {
  const { data, error } = await supabase
    .from('horas_timer_ativo')
    .select('*')
    .eq('colaborador_id', colaboradorId)
    .maybeSingle();
  if (error) throw error;
  return normalizeTimer(data);
}

export async function startTimer(colaboradorId, { projetoId, descricao }) {
  const { data, error } = await supabase
    .from('horas_timer_ativo')
    .upsert({
      colaborador_id: colaboradorId,
      projeto_id: projetoId || null,
      descricao: descricao || null,
      inicio: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return normalizeTimer(data);
}

// Encerra: lê o timer, remove a linha e devolve o registro para virar apontamento.
export async function stopTimer(colaboradorId) {
  const { data, error } = await supabase
    .from('horas_timer_ativo')
    .select('*')
    .eq('colaborador_id', colaboradorId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { error: delErr } = await supabase
    .from('horas_timer_ativo')
    .delete()
    .eq('colaborador_id', colaboradorId);
  if (delErr) throw delErr;
  return normalizeTimer(data);
}
