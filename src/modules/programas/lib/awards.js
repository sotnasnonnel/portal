import { supabase } from '../../../services/supabase';
import { AWARDS_PERGUNTAS } from '../../../config/programas';
import { erroDoArquivo, erroDoVideo, tipoDoArquivo } from './awardsRegras';

/**
 * Acesso a dados dos Projetos do Ano. A RLS faz o recorte: cada um recebe os
 * próprios projetos, mais os que estão na votação depois que ela abre; quem
 * avalia recebe todos. As duas telas usam a mesma consulta.
 *
 * "Finalistas" no banco e aqui são os projetos NA VOTAÇÃO: desde 12/11 todos os
 * inscritos entram nela sozinhos quando a votação abre (awards_mudar_fase).
 */

const BUCKET = 'programas-awards';
const COLUNAS = `id, numero, autor_id, categoria, ${AWARDS_PERGUNTAS.map((p) => p.campo).join(', ')}, video, apresentacao, criado_em`;
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

/**
 * Upload pelo mesmo endpoint que o supabase-js usa, mas por XHR: o vídeo pode
 * ter 300 MB e levar minutos, e só o XHR conta o progresso para a barra da tela.
 */
async function subirComProgresso(path, arquivo, tipo, onProgresso) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('sua sessão expirou, entre de novo no Portal');
  const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', import.meta.env.VITE_SUPABASE_ANON_KEY);
    xhr.setRequestHeader('Content-Type', tipo);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgresso?.(e.loaded / e.total); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { resolve(); return; }
      let motivo = `erro ${xhr.status}`;
      try { motivo = JSON.parse(xhr.responseText).message || motivo; } catch { /* resposta sem JSON */ }
      reject(new Error(motivo));
    };
    xhr.onerror = () => reject(new Error('a conexão caiu durante o envio'));
    xhr.send(arquivo);
  });
}

async function enviarArquivo(arquivo, autorId, validar, onProgresso) {
  const problema = validar(arquivo);
  if (problema) throw new Error(problema);
  const tipo = tipoDoArquivo(arquivo.name);
  const nomeSeguro = String(arquivo.name).normalize('NFD').replace(/[^\w.-]+/g, '_');
  const path = `${autorId}/${crypto.randomUUID()}-${nomeSeguro}`;
  try {
    await subirComProgresso(path, arquivo, tipo, onProgresso);
  } catch (e) {
    throw new Error(`${arquivo.name}: não foi possível enviar (${e.message}).`);
  }
  return {
    path, nome: arquivo.name, tipo, tamanho: arquivo.size, enviado_em: new Date().toISOString(),
  };
}

/** Não bloqueia a tela: o registro já foi gravado, sobra no máximo um arquivo órfão. */
async function removerArquivos(...paths) {
  const validos = paths.filter(Boolean);
  if (!validos.length) return;
  const { error } = await supabase.storage.from(BUCKET).remove(validos);
  if (error) console.warn('Projetos do Ano: arquivo não removido do bucket', error.message);
}

const respostas = (valores) => ({
  categoria: valores.categoria,
  ...Object.fromEntries(AWARDS_PERGUNTAS.map(({ campo }) => [campo, String(valores[campo] || '').trim()])),
});

/**
 * Sobe o vídeo e a apresentação (os que vierem). `onProgresso(etapa, fracao)`,
 * com etapa 'video' ou 'apresentacao'. Se a segunda falhar, apaga a primeira.
 */
async function enviarArquivos({ video, apresentacao }, autorId, onProgresso) {
  const novoVideo = video
    ? await enviarArquivo(video, autorId, erroDoVideo, (f) => onProgresso?.('video', f))
    : null;
  try {
    const novaApresentacao = apresentacao
      ? await enviarArquivo(apresentacao, autorId, erroDoArquivo, (f) => onProgresso?.('apresentacao', f))
      : null;
    return { novoVideo, novaApresentacao };
  } catch (e) {
    await removerArquivos(novoVideo?.path);
    throw e;
  }
}

export async function criarProjeto(valores, arquivos, autorId, onProgresso) {
  const { novoVideo, novaApresentacao } = await enviarArquivos(arquivos, autorId, onProgresso);
  const { data, error } = await supabase
    .from('programas_awards_projetos')
    .insert([{ ...respostas(valores), autor_id: autorId, video: novoVideo, apresentacao: novaApresentacao }])
    .select('id, numero, codigo_setor')
    .single();
  if (error) {
    await removerArquivos(novoVideo?.path, novaApresentacao?.path);
    throw new Error(`Não foi possível cadastrar o projeto: ${error.message}`);
  }
  return data;
}

export async function editarProjeto(projeto, valores, arquivos, autorId, onProgresso) {
  const { novoVideo, novaApresentacao } = await enviarArquivos(arquivos, autorId, onProgresso);
  // .select().maybeSingle(): UPDATE barrado pela RLS não dá erro, só volta vazio.
  const { data, error } = await supabase
    .from('programas_awards_projetos')
    .update({
      ...respostas(valores),
      video: novoVideo || projeto.video,
      apresentacao: novaApresentacao || projeto.apresentacao,
    })
    .eq('id', projeto.id)
    .select('id, numero, codigo_setor')
    .maybeSingle();
  if (error || !data) {
    await removerArquivos(novoVideo?.path, novaApresentacao?.path);
    throw new Error(`Não foi possível salvar o projeto: ${error?.message || FORA_DO_PRAZO}`);
  }
  await removerArquivos(novoVideo && projeto.video?.path, novaApresentacao && projeto.apresentacao?.path);
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
  await removerArquivos(projeto.video?.path, projeto.apresentacao?.path);
}

// ============================ Fases, votos e pódio ============================
// Quem grava aqui são as funções do banco (supabase_migration_programas_awards_votacao.sql):
// elas conferem a fase e quem está chamando.

export async function buscarEstado() {
  const { data, error } = await supabase
    .from('programas_awards_estado')
    .select('fase, max_finalistas, mudou_em')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw new Error(`Não foi possível carregar a fase do prêmio: ${error.message}`);
  return data || { fase: 'validacao', max_finalistas: 6, mudou_em: null };
}

/** Ids dos projetos na votação. Nas inscrições, a tabela está vazia. */
export async function listarFinalistas() {
  const { data, error } = await supabase.from('programas_awards_finalistas').select('projeto_id');
  if (error) throw new Error(`Não foi possível carregar os finalistas: ${error.message}`);
  return new Set((data || []).map((f) => f.projeto_id));
}

async function chamar(funcao, parametros) {
  const { data, error } = await supabase.rpc(funcao, parametros);
  if (error) throw new Error(error.message);
  return data;
}

export const mudarFase = (fase) => chamar('awards_mudar_fase', { p_fase: fase });

/** Apaga votos e pódio, tira os projetos da votação e volta às inscrições. O banco só deixa antes de 16/11. */
export const reiniciarPremiacao = () => chamar('awards_reiniciar_premiacao');

/** O voto da pessoa, por categoria: { operacao: [id1, id2, id3], backoffice: [...] }. */
export async function listarMeusVotos(colaboradorId) {
  const { data, error } = await supabase
    .from('programas_awards_votos')
    .select('categoria, posicao, projeto_id, votado_em')
    .eq('eleitor_id', colaboradorId)
    .order('posicao');
  if (error) throw new Error(`Não foi possível carregar o seu voto: ${error.message}`);
  const votos = {};
  (data || []).forEach((v) => {
    votos[v.categoria] = votos[v.categoria] || [];
    votos[v.categoria][v.posicao - 1] = v.projeto_id;
  });
  return votos;
}

export const votar = (categoria, projetos) => chamar('awards_votar', { p_categoria: categoria, p_projetos: projetos });

/** Soma por finalista, só para quem avalia. */
export async function buscarResultado() {
  return (await chamar('awards_resultado')) || [];
}

/** O pódio por categoria: { operacao: [id1, id2, id3], backoffice: [...] }. */
export async function listarPodio() {
  const { data, error } = await supabase
    .from('programas_awards_podio')
    .select('categoria, posicao, projeto_id')
    .order('posicao');
  if (error) throw new Error(`Não foi possível carregar os vencedores: ${error.message}`);
  const podio = {};
  (data || []).forEach((p) => {
    podio[p.categoria] = podio[p.categoria] || [];
    podio[p.categoria][p.posicao - 1] = p.projeto_id;
  });
  return podio;
}

/** A comissão confirma o pódio (resolve o empate). Nada fica público ainda. */
export const confirmarPodio = (podio) => chamar('awards_confirmar_podio', {
  p_operacao: podio.operacao || [],
  p_backoffice: podio.backoffice || [],
});

/** Chamado pela cerimônia depois do último 1º lugar: aí o pódio aparece para todos. */
export const publicarVencedores = () => chamar('awards_publicar_vencedores');

// ============================ Nota da comissão ============================

/** { projeto_id: { criterio: nota } }. Só quem avalia recebe algo. */
export async function listarNotas() {
  const { data, error } = await supabase.from('programas_awards_notas').select('projeto_id, criterio, nota');
  if (error) throw new Error(`Não foi possível carregar as notas da comissão: ${error.message}`);
  const notas = {};
  (data || []).forEach((n) => {
    notas[n.projeto_id] = notas[n.projeto_id] || {};
    notas[n.projeto_id][n.criterio] = Number(n.nota);
  });
  return notas;
}

/**
 * Grava a nota de consenso de um projeto: `valores` é { criterio: nota }.
 * .select(): upsert barrado pela RLS (fase errada) não dá erro, só volta vazio.
 */
export async function salvarNotas(projetoId, valores, colaboradorId) {
  const linhas = Object.entries(valores).map(([criterio, nota]) => ({
    projeto_id: projetoId,
    criterio,
    nota,
    atualizado_em: new Date().toISOString(),
    atualizado_por: colaboradorId,
  }));
  const { data, error } = await supabase
    .from('programas_awards_notas')
    .upsert(linhas, { onConflict: 'projeto_id,criterio' })
    .select('criterio');
  if (error || (data || []).length !== linhas.length) {
    throw new Error(`Não foi possível salvar as notas: ${error?.message || 'a votação precisa estar aberta ou encerrada.'}`);
  }
}

/** Bucket privado: a URL vence em 2 minutos e já vem marcada para download. */
export async function urlDaApresentacao(apresentacao) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(apresentacao.path, 120, { download: apresentacao.nome });
  if (error) throw new Error(`Não foi possível baixar o arquivo: ${error.message}`);
  return data.signedUrl;
}

/**
 * Para tocar o vídeo na própria tela. Vale 1 hora, e não 2 minutos: o player
 * pede pedaços do arquivo enquanto a pessoa assiste ou volta o vídeo.
 */
export async function urlParaAssistir(video) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(video.path, 3600);
  if (error) throw new Error(`Não foi possível carregar o vídeo: ${error.message}`);
  return data.signedUrl;
}
