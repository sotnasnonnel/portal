import { supabase } from './supabase';
import { camposDoApontamento, normalizarCampo, paraBanco } from './camposEquipe';

// ============================================================================
// Camada de dados do Controle de Horas.
// Pessoas vêm de `colaboradores`. O papel do módulo (horas_role) e a gerência
// (horas_gerencia_id) vivem lá e são editados em /portal-admin e /horas/equipe.
// Cada GERÊNCIA (equipe) tem os seus projetos E os seus CAMPOS de apontamento
// (horas_campos_apontamento: rótulo, tipo, opções e obrigatoriedade), montados
// em /horas/config/apontamento. O apontamento guarda a gerência (snapshot), o
// projeto e o que foi preenchido nesses campos — em jsonb, com o rótulo junto
// (ver lib/camposEquipe.js).
// `duracao_ms` é calculada no banco e o cronômetro vive em `horas_timer_ativo`.
// ============================================================================

// ---- Gerências ------------------------------------------------------------
export async function fetchGerencias() {
  const { data, error } = await supabase.from('horas_gerencias').select('*').order('nome');
  if (error) throw error;
  return data || [];
}

export async function createGerencia(nome) {
  const { data, error } = await supabase.from('horas_gerencias').insert({ nome }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteGerencia(id) {
  const { error } = await supabase.from('horas_gerencias').delete().eq('id', id);
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

// Projetos visíveis ao usuário AO APONTAR: os da sua área + os das áreas de
// todos os gestores acima dele na árvore (herança pela cadeia de gestores). A
// RPC (SECURITY DEFINER) resolve a cadeia; a leitura dos projetos é livre (RLS
// `using(true)`), então filtramos aqui pelas gerências devolvidas.
export async function fetchProjetosVisiveis({ incluirArquivados = false } = {}) {
  const { data: ger, error: gerErr } = await supabase.rpc('horas_gerencias_visiveis');
  if (gerErr) throw gerErr;
  const ids = (ger || []).map((r) => (typeof r === 'string' ? r : r?.horas_gerencias_visiveis)).filter(Boolean);
  if (!ids.length) return [];
  let q = supabase.from('horas_projetos').select('*').in('gerencia_id', ids).order('nome');
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

// ---- Campos do apontamento (por equipe) -----------------------------------
// Leitura livre (a pessoa precisa dos campos da PRÓPRIA equipe para apontar);
// a escrita é da liderança daquela área — quem garante é a RLS
// (app_private.pode_gerir_gerencia), igual aos projetos.
export async function fetchCamposEquipe(gerenciaId) {
  if (!gerenciaId) return [];
  const { data, error } = await supabase
    .from('horas_campos_apontamento')
    .select('*')
    .eq('gerencia_id', gerenciaId)
    .order('ordem')
    .order('criado_em');
  if (error) throw error;
  return (data || []).map(normalizarCampo);
}

export async function createCampoEquipe(gerenciaId, campo) {
  const { data, error } = await supabase
    .from('horas_campos_apontamento')
    .insert(paraBanco(campo, gerenciaId))
    .select()
    .single();
  if (error) throw error;
  return normalizarCampo(data);
}

export async function updateCampoEquipe(id, campo) {
  const { data, error } = await supabase
    .from('horas_campos_apontamento')
    .update(paraBanco(campo))
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return normalizarCampo(data);
}

export async function deleteCampoEquipe(id) {
  const { error } = await supabase.from('horas_campos_apontamento').delete().eq('id', id);
  if (error) throw error;
}

// Reordenar é só reescrever a coluna `ordem` dos campos que mudaram de lugar.
export async function reordenarCamposEquipe(campos) {
  for (const [i, c] of campos.entries()) {
    if (c.ordem === i) continue;
    const { error } = await supabase
      .from('horas_campos_apontamento')
      .update({ ordem: i })
      .eq('id', c.id);
    if (error) throw error;
  }
}

// Cria os campos de um modelo (ex.: MODELO_PADRAO) de uma vez, na ordem dada.
export async function criarCamposEmLote(gerenciaId, modelo) {
  const { data, error } = await supabase
    .from('horas_campos_apontamento')
    .insert(modelo.map((c, ordem) => paraBanco({ ...c, ordem }, gerenciaId)))
    .select();
  if (error) throw error;
  return (data || []).map(normalizarCampo);
}

// ---- Apontamentos ---------------------------------------------------------
// Escopo agora segue a HIERARQUIA da Gestão de Pessoas (via RLS):
//   usuario                -> os próprios;
//   coordenador | gestor   -> o próprio + toda a subárvore abaixo (a RLS filtra);
//   admin/super            -> tudo (a RLS libera).
// Só o 'usuario' precisa do filtro explícito por colaborador; para a gestão
// deixamos a RLS devolver a subárvore. Filtro por intervalo limita o payload.
export async function fetchApontamentos({ role, colaboradorId, sinceTs, ateTs } = {}) {
  let q = supabase.from('horas_apontamentos').select('*').order('inicio', { ascending: false });
  if (role !== 'coordenador' && role !== 'gestor') {
    q = q.eq('colaborador_id', colaboradorId ?? '00000000-0000-0000-0000-000000000000');
  }
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
  campos,
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
      campos: campos || [],
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
    // [{ id, label, valor }] — já resolvendo os dois legados (o catálogo fixo em
    // sigla/tarefa/etiqueta/tarefa2 e as atividades controladas em `ativ`), para
    // as telas lidarem com um formato só.
    campos: camposDoApontamento(row),
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
    campos: camposDoApontamento(row),
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

export async function startTimer(colaboradorId, { projetoId, campos, descricao }) {
  const { data, error } = await supabase
    .from('horas_timer_ativo')
    .upsert({
      colaborador_id: colaboradorId,
      projeto_id: projetoId || null,
      campos: campos || [],
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
