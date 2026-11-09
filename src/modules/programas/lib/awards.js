import { supabase } from '../../../services/supabase';
import { AWARDS_PERGUNTAS } from '../../../config/programas';
import { erroDoArquivo, tipoDoArquivo } from './awardsRegras';

/**
 * Acesso a dados dos Projetos do Ano. A RLS faz o recorte: cada um recebe os
 * próprios projetos, quem avalia recebe todos. As duas telas usam a mesma consulta.
 */

const BUCKET = 'programas-awards';
const COLUNAS = `id, numero, autor_id, categoria, ${AWARDS_PERGUNTAS.map((p) => p.campo).join(', ')}, apresentacao, criado_em`;
const FORA_DO_PRAZO = 'As inscrições não estão abertas, ou o projeto não é seu.';

async function anexarAutores(linhas) {
  const ids = [...new Set(linhas.map((l) => l.autor_id))];
  if (!ids.length) return [];
  const { data } = await supabase.rpc('nomes_colaboradores', { p_ids: ids });
  const nomes = new Map((data || []).map((p) => [p.id, p.nome]));
  return linhas.map((l) => ({ ...l, autorNome: nomes.get(l.autor_id) || '' }));
}

export async function listarProjetos() {
  const { data, error } = await supabase
    .from('programas_awards_projetos')
    .select(COLUNAS)
    .order('numero', { ascending: false });
  if (error) throw new Error(`Não foi possível carregar os projetos: ${error.message}`);
  return anexarAutores(data || []);
}

export async function buscarProjeto(id) {
  const { data, error } = await supabase
    .from('programas_awards_projetos')
    .select(COLUNAS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`Não foi possível carregar o projeto: ${error.message}`);
  return data;
}

async function enviarArquivo(arquivo, autorId) {
  const problema = erroDoArquivo(arquivo);
  if (problema) throw new Error(problema);
  const tipo = tipoDoArquivo(arquivo.name);
  const nomeSeguro = String(arquivo.name).normalize('NFD').replace(/[^\w.-]+/g, '_');
  const path = `${autorId}/${crypto.randomUUID()}-${nomeSeguro}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, arquivo, { contentType: tipo });
  if (error) throw new Error(`${arquivo.name}: não foi possível enviar (${error.message}).`);
  return {
    path, nome: arquivo.name, tipo, tamanho: arquivo.size, enviado_em: new Date().toISOString(),
  };
}

/** Não bloqueia a tela: o registro já foi gravado, sobra no máximo um arquivo órfão. */
async function removerArquivo(path) {
  if (!path) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.warn('Projetos do Ano: arquivo não removido do bucket', error.message);
}

const respostas = (valores) => ({
  categoria: valores.categoria,
  ...Object.fromEntries(AWARDS_PERGUNTAS.map(({ campo }) => [campo, String(valores[campo] || '').trim()])),
});

export async function criarProjeto(valores, arquivo, autorId) {
  const apresentacao = arquivo ? await enviarArquivo(arquivo, autorId) : null;
  const { data, error } = await supabase
    .from('programas_awards_projetos')
    .insert([{ ...respostas(valores), autor_id: autorId, apresentacao }])
    .select('id, numero, codigo_setor')
    .single();
  if (error) {
    await removerArquivo(apresentacao?.path);
    throw new Error(`Não foi possível cadastrar o projeto: ${error.message}`);
  }
  return data;
}

export async function editarProjeto(projeto, valores, arquivo, autorId) {
  const novo = arquivo ? await enviarArquivo(arquivo, autorId) : null;
  // .select().maybeSingle(): UPDATE barrado pela RLS não dá erro, só volta vazio.
  const { data, error } = await supabase
    .from('programas_awards_projetos')
    .update({ ...respostas(valores), apresentacao: novo || projeto.apresentacao })
    .eq('id', projeto.id)
    .select('id, numero, codigo_setor')
    .maybeSingle();
  if (error || !data) {
    await removerArquivo(novo?.path);
    throw new Error(`Não foi possível salvar o projeto: ${error?.message || FORA_DO_PRAZO}`);
  }
  if (novo) await removerArquivo(projeto.apresentacao?.path);
  return data;
}

export async function excluirProjeto(projeto) {
  const { data, error } = await supabase
    .from('programas_awards_projetos')
    .delete()
    .eq('id', projeto.id)
    .select('id');
  if (error || !data?.length) {
    throw new Error(`Não foi possível excluir o projeto: ${error?.message || FORA_DO_PRAZO}`);
  }
  await removerArquivo(projeto.apresentacao?.path);
}

/** Bucket privado: a URL vence em 2 minutos e já vem marcada para download. */
export async function urlDaApresentacao(apresentacao) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(apresentacao.path, 120, { download: apresentacao.nome });
  if (error) throw new Error(`Não foi possível baixar o arquivo: ${error.message}`);
  return data.signedUrl;
}
