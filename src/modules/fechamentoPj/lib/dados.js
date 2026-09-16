import { supabase } from '../../../services/supabase';

/**
 * Única camada de acesso ao Supabase do Fechamento PJ. Nenhuma página fala com
 * o banco direto.
 *
 * O que fica no banco e não aqui: a trava de competência fechada (gatilho), o
 * histórico de valor contratual (gatilho), o autor da auditoria (gatilho) e as
 * transições atômicas (RPCs pj_gravar_envelopes, pj_fechar_competencia,
 * pj_reabrir_competencia, pj_abrir_competencia, pj_incluir_no_mes).
 */

// UPDATE barrado pela RLS não dá erro, dá zero linhas.
const exigirLinha = (data, erro, mensagem) => {
  if (erro) throw new Error(`${mensagem}: ${erro.message}`);
  if (!data || (Array.isArray(data) && !data.length)) throw new Error(`${mensagem}: você não tem permissão para esta ação.`);
};
const falhou = (erro, mensagem) => {
  if (erro) throw new Error(`${mensagem}: ${erro.message}`);
};

// PostgREST devolve no máximo 1000 linhas por chamada: pagina.
async function tudo(consulta, mensagem, lote = 1000) {
  const linhas = [];
  for (let de = 0; ; de += lote) {
    const { data, error } = await consulta().range(de, de + lote - 1);
    falhou(error, mensagem);
    linhas.push(...(data || []));
    if (!data || data.length < lote) break;
  }
  return linhas;
}

export async function nomesColaboradores(ids = []) {
  const unicos = [...new Set(ids.filter(Boolean))];
  if (!unicos.length) return new Map();
  const { data } = await supabase.rpc('nomes_colaboradores', { p_ids: unicos });
  return new Map((data || []).map((p) => [p.id, p.nome]));
}

// ---------------------------------------------------------------------------
// Configuração, códigos, centros de custo
// ---------------------------------------------------------------------------

export async function obterConfig() {
  const { data, error } = await supabase.from('pj_config').select('*').eq('id', 1).maybeSingle();
  falhou(error, 'Não foi possível carregar a configuração');
  if (!data) throw new Error('Sem acesso ao Fechamento PJ (configuração não encontrada).');
  return data;
}

export async function salvarConfig(patch) {
  const { data, error } = await supabase.from('pj_config').update(patch).eq('id', 1).select();
  exigirLinha(data, error, 'Não foi possível salvar a configuração');
  return data[0];
}

export async function listarCodigos() {
  const { data, error } = await supabase.from('pj_codigos').select('*').order('codigo');
  falhou(error, 'Não foi possível carregar os códigos');
  return data || [];
}

export async function salvarCodigo(codigo, { novo = false } = {}) {
  const linha = {
    codigo: String(codigo.codigo).trim().toUpperCase(),
    descricao: String(codigo.descricao).trim().toLocaleUpperCase('pt-BR'),
    natureza: codigo.natureza,
    ativo: codigo.ativo !== false,
    origem: codigo.origem || 'Cadastro manual',
  };
  const q = novo ? supabase.from('pj_codigos').insert(linha) : supabase.from('pj_codigos').update(linha).eq('codigo', linha.codigo);
  const { data, error } = await q.select();
  if (error?.code === '23505') throw new Error(`O código ${linha.codigo} já existe.`);
  exigirLinha(data, error, 'Não foi possível salvar o código');
  return data[0];
}

export async function excluirCodigo(codigo) {
  const { count, error: e1 } = await supabase.from('pj_eventos').select('id', { count: 'exact', head: true }).eq('codigo', codigo);
  falhou(e1, 'Não foi possível conferir o uso do código');
  if (count) throw new Error(`O código ${codigo} está em ${count} lançamento(s). Inative em vez de excluir.`);
  const { data, error } = await supabase.from('pj_codigos').delete().eq('codigo', codigo).select();
  exigirLinha(data, error, 'Não foi possível excluir o código');
}

export async function listarCentros() {
  const { data, error } = await supabase.from('pj_centros_custo').select('*').order('cod_ct');
  falhou(error, 'Não foi possível carregar os centros de custo');
  return data || [];
}

export const mapaCentros = (centros) => Object.fromEntries(centros.filter((c) => c.codigo_rm).map((c) => [c.cod_ct, c.codigo_rm]));

export async function salvarCentros(lista) {
  if (!lista.length) return [];
  const { data, error } = await supabase.from('pj_centros_custo')
    .upsert(lista.map((c) => ({ cod_ct: c.cod_ct, codigo_rm: c.codigo_rm || null, descricao: c.descricao ?? null, origem: c.origem || 'Manual' })), { onConflict: 'cod_ct' })
    .select();
  exigirLinha(data, error, 'Não foi possível salvar os centros de custo');
  return data;
}

export async function excluirCentro(codCt) {
  const { data, error } = await supabase.from('pj_centros_custo').delete().eq('cod_ct', codCt).select();
  exigirLinha(data, error, 'Não foi possível excluir o centro de custo');
}

// ---------------------------------------------------------------------------
// Prestadores
// ---------------------------------------------------------------------------

export async function listarPrestadores() {
  return tudo(() => supabase.from('pj_prestadores').select('*').order('nome'), 'Não foi possível carregar os prestadores');
}

export async function obterPrestador(id) {
  const { data, error } = await supabase.from('pj_prestadores').select('*').eq('id', id).maybeSingle();
  falhou(error, 'Não foi possível carregar o prestador');
  return data;
}

async function proximoCodigo() {
  const { data, error } = await supabase.from('pj_prestadores').select('codigo').order('codigo', { ascending: false }).limit(1);
  falhou(error, 'Não foi possível gerar o código');
  return String((Number(data?.[0]?.codigo) || 0) + 1).padStart(6, '0');
}

const CAMPOS_PRESTADOR = ['nome', 'empresa', 'email', 'situacao', 'cadastro_origem', 'razao_social', 'cnpj', 'cpf', 'rg',
  'data_nascimento', 'sexo', 'telefone', 'email_pessoal', 'cep', 'tipo_logradouro', 'logradouro', 'numero', 'complemento',
  'bairro', 'municipio', 'uf', 'pais', 'modalidade', 'data_inicio', 'data_fim', 'funcao', 'projeto', 'gestor',
  'secao_codigo', 'secao_nome', 'municipio_atuacao', 'uf_atuacao', 'valor_mensal', 'banco', 'banco_codigo', 'agencia',
  'conta', 'pix', 'contabilidade', 'beneficios', 'dependentes'];

const limparPrestador = (p) => Object.fromEntries(CAMPOS_PRESTADOR.filter((k) => k in p).map((k) => {
  const v = p[k];
  return [k, typeof v === 'string' && !v.trim() ? null : v];
}));

export async function salvarPrestador(p) {
  const linha = limparPrestador(p);
  if (p.id) {
    const { data, error } = await supabase.from('pj_prestadores').update(linha).eq('id', p.id).select();
    exigirLinha(data, error, 'Não foi possível salvar o prestador');
    return data[0];
  }
  // Duas pessoas criando ao mesmo tempo podem pegar o mesmo código: tenta de novo.
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    const codigo = await proximoCodigo();
    const { data, error } = await supabase.from('pj_prestadores').insert({ ...linha, codigo }).select();
    if (error?.code === '23505' && /codigo/.test(error.message)) continue;
    exigirLinha(data, error, 'Não foi possível cadastrar o prestador');
    return data[0];
  }
  throw new Error('Não foi possível gerar um código livre para o prestador. Tente de novo.');
}

export async function historicoValores(prestadorId) {
  const { data, error } = await supabase.from('pj_historico_valores').select('*').eq('prestador_id', prestadorId).order('registrado_em', { ascending: false });
  falhou(error, 'Não foi possível carregar o histórico de valores');
  return data || [];
}

export async function listarRateios(prestadorId = null) {
  return tudo(() => {
    let q = supabase.from('pj_prestador_rateios').select('*').order('cod_ct');
    if (prestadorId) q = q.eq('prestador_id', prestadorId);
    return q;
  }, 'Não foi possível carregar os rateios');
}

// Substitui o rateio inteiro de um prestador.
export async function salvarRateio(prestadorId, itens, origem = 'Manual') {
  const { error: e1 } = await supabase.from('pj_prestador_rateios').delete().eq('prestador_id', prestadorId);
  falhou(e1, 'Não foi possível limpar o rateio anterior');
  if (!itens.length) return [];
  const { data, error } = await supabase.from('pj_prestador_rateios').insert(itens.map((i) => ({
    prestador_id: prestadorId, cod_ct: i.cod_ct, percentual: Number(i.percentual),
    alocacao_organograma: i.alocacao_organograma ?? null, origem: i.origem || origem,
  }))).select();
  exigirLinha(data, error, 'Não foi possível gravar o rateio');
  return data;
}

// ---------------------------------------------------------------------------
// Fornecedores TOTVS RM
// ---------------------------------------------------------------------------

export async function listarFornecedores() {
  return tudo(() => supabase.from('pj_fornecedores_rm').select('*').order('razao_social'), 'Não foi possível carregar os fornecedores');
}

const CAMPOS_FORNECEDOR = ['prestador_id', 'codigo_rm', 'nome_fantasia', 'razao_social', 'cnpj', 'classificacao', 'categoria',
  'inscricao_estadual', 'inscricao_municipal', 'tipo_codigo', 'tipo_descricao', 'global', 'ativo', 'bloqueado',
  'endereco', 'contatos', 'bancos', 'origem'];

export async function salvarFornecedor(f) {
  const linha = Object.fromEntries(CAMPOS_FORNECEDOR.filter((k) => k in f).map((k) => [k, f[k] === '' ? null : f[k]]));
  const q = f.id ? supabase.from('pj_fornecedores_rm').update(linha).eq('id', f.id) : supabase.from('pj_fornecedores_rm').insert(linha);
  const { data, error } = await q.select();
  if (error?.code === '23505') throw new Error('Já existe um cadastro com este código RM ou para este prestador.');
  exigirLinha(data, error, 'Não foi possível salvar o fornecedor');
  return data[0];
}

export async function excluirFornecedor(id) {
  const { data, error } = await supabase.from('pj_fornecedores_rm').delete().eq('id', id).select();
  exigirLinha(data, error, 'Não foi possível excluir o fornecedor');
}

// ---------------------------------------------------------------------------
// Competências e envelopes
// ---------------------------------------------------------------------------

export async function listarCompetencias() {
  const { data, error } = await supabase.from('pj_competencias').select('*').order('competencia', { ascending: false });
  falhou(error, 'Não foi possível carregar as competências');
  return data || [];
}

export async function abrirCompetencia(competencia, { envioTermos = null, prazoNf = null, pagamento = null } = {}) {
  const { data, error } = await supabase.rpc('pj_abrir_competencia', {
    p_competencia: competencia, p_envio_termos: envioTermos, p_prazo_nf: prazoNf, p_pagamento: pagamento,
  });
  falhou(error, 'Não foi possível abrir a competência');
  return data;
}

export async function fecharCompetencia(competencia) {
  const { error } = await supabase.rpc('pj_fechar_competencia', { p_competencia: competencia });
  falhou(error, 'Não foi possível fechar a competência');
}

export async function reabrirCompetencia(competencia, motivo) {
  const { error } = await supabase.rpc('pj_reabrir_competencia', { p_competencia: competencia, p_motivo: motivo });
  falhou(error, 'Não foi possível reabrir a competência');
}

export async function salvarCalendario(competencia, { data_envio_termos, prazo_nf, data_pagamento }) {
  const { data, error } = await supabase.from('pj_competencias')
    .update({ data_envio_termos: data_envio_termos || null, prazo_nf: prazo_nf || null, data_pagamento: data_pagamento || null })
    .eq('competencia', competencia).select();
  exigirLinha(data, error, 'Não foi possível salvar o calendário');
  return data[0];
}

export async function listarEnvelopes(competencia) {
  return tudo(() => supabase.from('pj_envelopes').select('*, eventos:pj_eventos(*)').eq('competencia', competencia).order('id'),
    'Não foi possível carregar os envelopes', 500);
}

export async function envelopesDoPrestador(prestadorId) {
  const { data, error } = await supabase.from('pj_envelopes').select('*, eventos:pj_eventos(*)')
    .eq('prestador_id', prestadorId).order('competencia', { ascending: false });
  falhou(error, 'Não foi possível carregar os envelopes do prestador');
  return data || [];
}

export async function listarCalculos(envelopeId) {
  const { data, error } = await supabase.from('pj_calculos').select('*').eq('envelope_id', envelopeId)
    .order('calculado_em', { ascending: false }).limit(12);
  falhou(error, 'Não foi possível carregar o log de cálculo');
  return data || [];
}

export async function gravarEnvelopes(competencia, payloads) {
  if (!payloads.length) return 0;
  // Lotes pequenos: cada envelope é uma transação curta dentro da RPC.
  let total = 0;
  for (let i = 0; i < payloads.length; i += 40) {
    const { data, error } = await supabase.rpc('pj_gravar_envelopes', { p_competencia: competencia, p_envelopes: payloads.slice(i, i + 40) });
    falhou(error, 'Não foi possível gravar os envelopes');
    total += data || 0;
  }
  return total;
}

export async function incluirNoMes(competencia, prestadorId) {
  const { data, error } = await supabase.rpc('pj_incluir_no_mes', { p_competencia: competencia, p_prestador: prestadorId });
  falhou(error, 'Não foi possível incluir o prestador na competência');
  return data;
}

// Termo e envio: liberados mesmo em competência fechada.
export async function marcarTermo(envelopeIds, acao, userId) {
  const agora = new Date().toISOString();
  const patch = acao === 'gerar'
    ? { termo: 'gerado', envio: 'preparado', termo_gerado_em: agora, termo_gerado_por: userId }
    : { envio: 'enviado', enviado_em: agora, enviado_por: userId };
  let q = supabase.from('pj_envelopes').update(patch).in('id', envelopeIds);
  q = acao === 'gerar' ? q.neq('termo', 'bloqueado') : q.eq('termo', 'gerado');
  const { data, error } = await q.select('id');
  falhou(error, acao === 'gerar' ? 'Não foi possível gerar os termos' : 'Não foi possível registrar o envio');
  return data?.length || 0;
}

/**
 * Envia o termo por e-mail (Edge Function send-termo-pj), um e-mail por
 * prestador. A função marca como enviado só o que de fato saiu e grava a
 * auditoria. Devolve [{ envelope_id, nome, email, status, motivo }], com
 * status 'enviado' | 'ignorado' | 'falhou'.
 */
export async function enviarTermosEmail(envelopeIds) {
  const { data, error } = await supabase.functions.invoke('send-termo-pj', { body: { envelope_ids: envelopeIds } });
  if (error) {
    let msg = error.message;
    try { msg = (await error.context?.json())?.error || msg; } catch { /* corpo não é JSON */ }
    throw new Error(`Não foi possível enviar os termos: ${msg}`);
  }
  return data?.resultados || [];
}

export async function salvarDocumentoPagamento(envelopeId, { nf_numero, rm_documento }) {
  const patch = {};
  if (nf_numero !== undefined) patch.nf_numero = nf_numero || null;
  if (rm_documento !== undefined) patch.rm_documento = rm_documento || null;
  const { data, error } = await supabase.from('pj_envelopes').update(patch).eq('id', envelopeId).select('id');
  exigirLinha(data, error, 'Não foi possível salvar o documento');
}

// ---------------------------------------------------------------------------
// Encerramentos
// ---------------------------------------------------------------------------

export async function listarEncerramentos({ prestadorId = null, vigentes = false } = {}) {
  let q = supabase.from('pj_encerramentos').select('*').order('registrado_em', { ascending: false });
  if (prestadorId) q = q.eq('prestador_id', prestadorId);
  if (vigentes) q = q.neq('status', 'cancelado');
  const { data, error } = await q;
  falhou(error, 'Não foi possível carregar os encerramentos');
  return data || [];
}

export async function registrarEncerramento(dados) {
  const { data, error } = await supabase.from('pj_encerramentos').insert(dados).select();
  if (error?.code === '23505') throw new Error('Este prestador já tem um encerramento vigente. Cancele o anterior antes.');
  exigirLinha(data, error, 'Não foi possível registrar o encerramento');
  return data[0];
}

export async function cancelarEncerramento(id, userId) {
  const { data, error } = await supabase.from('pj_encerramentos')
    .update({ status: 'cancelado', cancelado_em: new Date().toISOString(), cancelado_por: userId }).eq('id', id).select();
  exigirLinha(data, error, 'Não foi possível cancelar o encerramento');
  return data[0];
}

// ---------------------------------------------------------------------------
// Importações e auditoria
// ---------------------------------------------------------------------------

export async function registrarImportacao(dados) {
  const { error } = await supabase.from('pj_importacoes').insert(dados);
  falhou(error, 'Não foi possível registrar a importação');
}

export async function listarImportacoes(limite = 50) {
  const { data, error } = await supabase.from('pj_importacoes').select('*').order('importado_em', { ascending: false }).limit(limite);
  falhou(error, 'Não foi possível carregar as importações');
  return data || [];
}

// Auditoria não pode derrubar a ação que já deu certo: falha vira aviso no console.
export async function auditar(acao, detalhe = null, { competencia = null, prestadorId = null } = {}) {
  const { error } = await supabase.from('pj_auditoria').insert({ acao, detalhe, competencia, prestador_id: prestadorId });
  if (error) console.warn('[fechamentoPj] auditoria não gravada:', error.message);
}

export async function listarAuditoria({ limite = 300, competencia = null } = {}) {
  let q = supabase.from('pj_auditoria').select('*').order('em', { ascending: false }).limit(limite);
  if (competencia) q = q.eq('competencia', competencia);
  const { data, error } = await q;
  falhou(error, 'Não foi possível carregar a auditoria');
  return data || [];
}

// Histórico de valores por competência (todas as competências, sem eventos).
export async function historicoEnvelopes() {
  return tudo(() => supabase.from('pj_envelopes')
    .select('id, competencia, prestador_id, origem, bruto, descontos, liquido, termo, envio, enviado_em, cadastro')
    .order('competencia', { ascending: false }), 'Não foi possível carregar o histórico', 1000);
}
