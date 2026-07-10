import { supabase } from './supabase';

// ============================================================================
// Camada de dados do Controle de Horas.
// Pessoas vêm de `colaboradores`. O papel do módulo (horas_role) e a gerência
// (horas_gerencia_id) vivem lá e são editados em /portal-admin e /horas/equipe.
// Cada GERÊNCIA tem seus projetos e 3 atividades controladas; o apontamento
// guarda a gerência (snapshot) e os 3 valores escolhidos.
// `duracao_ms` é calculada no banco e o cronômetro vive em `horas_timer_ativo`.
// ============================================================================

// ---- Gerências ------------------------------------------------------------
export async function fetchGerencias() {
  const { data, error } = await supabase.from('horas_gerencias').select('*').order('nome');
  if (error) throw error;
  return data || [];
}

// As 3 atividades controladas são criadas por trigger no banco.
export async function createGerencia(nome) {
  const { data, error } = await supabase.from('horas_gerencias').insert({ nome }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteGerencia(id) {
  const { error } = await supabase.from('horas_gerencias').delete().eq('id', id);
  if (error) throw error;
}

// ---- Atividades controladas (3 por gerência, ordem 0..2) -------------------
export async function fetchAtividades(gerenciaId) {
  if (!gerenciaId) return [];
  const { data, error } = await supabase
    .from('horas_atividades')
    .select('*')
    .eq('gerencia_id', gerenciaId)
    .order('ordem');
  if (error) throw error;
  return data || [];
}

export async function updateAtividade(id, patch) {
  const { error } = await supabase.from('horas_atividades').update(patch).eq('id', id);
  if (error) throw error;
}

// ---- Projetos (por gerência) ----------------------------------------------
export async function fetchProjetos({ gerenciaId, incluirArquivados = false } = {}) {
  let q = supabase.from('horas_projetos').select('*').order('nome');
  if (gerenciaId) q = q.eq('gerencia_id', gerenciaId);
  if (!incluirArquivados) q = q.eq('arquivado', false);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createProjeto({ gerenciaId, nome, cliente, cor }) {
  const { data, error } = await supabase
    .from('horas_projetos')
    .insert({ gerencia_id: gerenciaId, nome, cliente: cliente || null, cor: cor || '#C44A28' })
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
// Escopo (espelha scopedApontamentos() do protótipo e a RLS):
//   diretoria -> todos;  gerente -> a gerência;  usuario -> os próprios.
// Filtro por intervalo mantém o payload limitado (escala).
export async function fetchApontamentos({ role, colaboradorId, gerenciaId, sinceTs, ateTs } = {}) {
  let q = supabase.from('horas_apontamentos').select('*').order('inicio', { ascending: false });
  if (role === 'gerente') q = q.eq('gerencia_id', gerenciaId ?? '00000000-0000-0000-0000-000000000000');
  else if (role !== 'diretoria') q = q.eq('colaborador_id', colaboradorId);
  if (sinceTs != null) q = q.gte('inicio', new Date(sinceTs).toISOString());
  if (ateTs != null) q = q.lt('inicio', new Date(ateTs).toISOString()); // ateTs = início do dia seguinte
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(normalizeApont);
}

// duracao_ms NÃO é enviada: o banco calcula (coluna gerada de fim - inicio).
export async function createApontamento({
  colaboradorId,
  gerenciaId,
  projetoId,
  ativ,
  descricao,
  inicioTs,
  fimTs,
}) {
  const { data, error } = await supabase
    .from('horas_apontamentos')
    .insert({
      colaborador_id: colaboradorId,
      gerencia_id: gerenciaId || null,
      projeto_id: projetoId || null,
      ativ: ativ || [],
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

// ---- Colaboradores --------------------------------------------------------
// RPC devolve SÓ id/nome/função/papel/gerência (nunca salário/senha) e apenas
// para gerente (sua equipe + quem não tem gerência) e diretoria (todos).
export async function fetchColaboradores() {
  const { data, error } = await supabase.rpc('horas_colaboradores');
  if (error) throw error;
  return (data || []).map((c) => ({
    id: c.id,
    nome: c.nome,
    funcao: c.funcao,
    role: c.horas_role || 'usuario',
    gerenciaId: c.gerencia_id,
  }));
}

// Vincula/desvincula alguém de uma gerência. O PAPEL é editado em /portal-admin.
export async function setGerenciaColaborador(colaboradorId, gerenciaId) {
  const { error } = await supabase.rpc('horas_set_gerencia', {
    p_colaborador: colaboradorId,
    p_gerencia: gerenciaId || null,
  });
  if (error) throw error;
}

function normalizeApont(row) {
  return {
    id: row.id,
    colaboradorId: row.colaborador_id,
    gerenciaId: row.gerencia_id,
    projetoId: row.projeto_id,
    ativ: row.ativ || [],
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
    ativ: row.ativ || [],
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

export async function startTimer(colaboradorId, { projetoId, ativ, descricao }) {
  const { data, error } = await supabase
    .from('horas_timer_ativo')
    .upsert({
      colaborador_id: colaboradorId,
      projeto_id: projetoId || null,
      ativ: ativ || [],
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
