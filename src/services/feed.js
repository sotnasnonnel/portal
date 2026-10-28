import { supabase } from './supabase';
import {
  ehVideo, FOTO_BYTES_MAX, FOTO_LADO_MAX, POR_PAGINA,
  VIDEO_BYTES_MAX, VIDEO_POSTER_LADO, VIDEO_SEG_MAX, VIDEO_TIPOS,
} from '../config/feed';

// Feed do portal. Tudo por RPC (supabase/supabase_migration_feed.sql): as
// tabelas não têm policy, então o banco decide quem vê, posta e modera.
// As fotos e os vídeos vão para o bucket privado feed-midia, na pasta de quem
// posta, e são lidos por link assinado.

const BUCKET = 'feed-midia';
const VALIDADE_LINK = 60 * 60; // 1 h — a página recarrega o feed bem antes disso

function checar(error) {
  if (error) throw new Error(error.message || 'Falha ao falar com o banco.');
}

/** Página do feed; com `post`, só aquele post (link do aviso de marcação). */
export async function listarFeed({ cursor = null, limite = POR_PAGINA, post = null } = {}) {
  const { data, error } = await supabase.rpc('feed_listar', {
    p_cursor_em: cursor?.em ?? null, p_cursor_id: cursor?.id ?? null, p_limite: limite, p_post: post,
  });
  checar(error);
  return data || [];
}

/** `mencoes`: [{ id, nome }] — o banco confere e avisa quem foi marcado. */
export async function postar(texto, midia = [], mencoes = []) {
  const { data, error } = await supabase.rpc('feed_postar', { p_texto: texto, p_midia: midia, p_mencoes: mencoes });
  checar(error);
  return data;
}

export async function editarPost(id, texto) {
  const { error } = await supabase.rpc('feed_editar', { p_id: id, p_texto: texto });
  checar(error);
}

export async function excluirPost(id) {
  const { error } = await supabase.rpc('feed_excluir', { p_id: id });
  checar(error);
}

/** Curte ou descurte: { curti, curtidas }. */
export async function curtir(id) {
  const { data, error } = await supabase.rpc('feed_curtir', { p_id: id });
  checar(error);
  return data?.[0] || null;
}

/** Quem curtiu um post: [{ colaborador_id, nome, funcao, moldura, titulo }], 100 no máximo. */
export async function listarCurtidas(postId) {
  const { data, error } = await supabase.rpc('feed_curtidas_listar', { p_post: postId });
  checar(error);
  return data || [];
}

/**
 * Os primeiros curtidores de vários posts de uma vez, para a linha
 * "Curtido por…": { [postId]: [{ colaborador_id, nome, moldura }] }.
 * Falha vira {} — a linha cai no número, que já vem no post.
 */
export async function resumoDasCurtidas(postIds = []) {
  if (!postIds.length) return {};
  const { data, error } = await supabase.rpc('feed_curtidas_resumo', { p_posts: postIds.slice(0, 50) });
  if (error) return {};
  const out = {};
  for (const r of data || []) (out[r.post_id] ||= []).push(r);
  return out;
}

export async function listarComentarios(postId) {
  const { data, error } = await supabase.rpc('feed_comentarios_listar', { p_post: postId });
  checar(error);
  return data || [];
}

export async function comentar(postId, texto, paiId = null, mencoes = []) {
  const { data, error } = await supabase.rpc('feed_comentar', {
    p_post: postId, p_texto: texto, p_pai: paiId, p_mencoes: mencoes,
  });
  checar(error);
  return data;
}

export async function excluirComentario(id) {
  const { error } = await supabase.rpc('feed_comentario_excluir', { p_id: id });
  checar(error);
}

export async function denunciar(tipo, id, motivo = '') {
  const { error } = await supabase.rpc('feed_denunciar', { p_tipo: tipo, p_id: id, p_motivo: motivo });
  checar(error);
}

// ---- Moderação ----------------------------------------------------------------

export async function moderar(tipo, id, ocultar, motivo = '') {
  const { error } = await supabase.rpc('feed_moderar', {
    p_tipo: tipo, p_id: id, p_ocultar: ocultar, p_motivo: motivo,
  });
  checar(error);
}

export async function fixar(id, fixarPost) {
  const { error } = await supabase.rpc('feed_fixar', { p_id: id, p_fixar: fixarPost });
  checar(error);
}

export async function listarDenuncias() {
  const { data, error } = await supabase.rpc('feed_denuncias_listar');
  checar(error);
  return data || [];
}

export async function descartarDenuncia(tipo, id) {
  const { error } = await supabase.rpc('feed_denuncia_descartar', { p_tipo: tipo, p_id: id });
  checar(error);
}

// ---- Fotos e vídeos -----------------------------------------------------------

export function carregarImagem(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler a foto.')); };
    img.src = url;
  });
}

// Versão do feed: o card tem no máximo 720px; 1280px cobre tela 2x sem
// sobrar. A grande (FOTO_LADO_MAX) só é baixada na tela cheia.
const LADO_FEED = 1280;
// Os arquivos nunca mudam (nome é um UUID novo a cada envio): o navegador e a
// CDN do Storage podem guardar por um ano.
const CACHE_ARQUIVO = '31536000';

/**
 * Redimensiona para `lado` no maior lado e regrava em WebP (bem menor que
 * JPEG). Navegador que não grava WebP (Safari antigo devolve PNG) cai para
 * JPEG. `fonte` é um <img> ou um <video> parado no quadro da capa — daí as
 * medidas virem de fora, que <video> não tem naturalWidth.
 */
export async function reduzir(fonte, lado, qualidade, larg = fonte.naturalWidth, alt = fonte.naturalHeight) {
  const escala = Math.min(1, lado / Math.max(larg, alt));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(larg * escala));
  canvas.height = Math.max(1, Math.round(alt * escala));
  canvas.getContext('2d').drawImage(fonte, 0, 0, canvas.width, canvas.height);
  let blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', qualidade));
  if (!blob || blob.type !== 'image/webp') {
    blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', qualidade));
  }
  if (!blob) throw new Error('Não foi possível preparar a foto.');
  if (blob.size > FOTO_BYTES_MAX) throw new Error('Foto grande demais mesmo depois de reduzida.');
  const webp = blob.type === 'image/webp';
  return { blob, ext: webp ? 'webp' : 'jpg', type: webp ? 'image/webp' : 'image/jpeg', width: canvas.width, height: canvas.height };
}

/**
 * Duas versões de cada foto: a grande (tela cheia) e a do feed. GIF passa
 * como veio, numa versão só (o canvas mataria a animação).
 */
async function prepararFoto(file) {
  const img = await carregarImagem(file);
  if (file.type === 'image/gif') {
    if (file.size > FOTO_BYTES_MAX) throw new Error('GIF maior que 8 MB.');
    return { grande: { blob: file, ext: 'gif', type: 'image/gif', width: img.naturalWidth, height: img.naturalHeight } };
  }
  const grande = await reduzir(img, FOTO_LADO_MAX, 0.85);
  const feed = Math.max(img.naturalWidth, img.naturalHeight) > LADO_FEED ? await reduzir(img, LADO_FEED, 0.8) : null;
  return { grande, feed };
}

// ---- Vídeo --------------------------------------------------------------------
// O vídeo sobe como veio: recomprimir no navegador pediria ffmpeg.wasm (uns
// 30 MB de wasm e minutos de CPU). Por isso o limite é duro e o arquivo é só
// medido — tamanho pelo File, duração e lados pelos metadados.

const EXT_VIDEO = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };

/** <video> com os metadados já lidos, e a URL local para liberar depois. */
function carregarVideo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.onloadedmetadata = () => resolve({ v, url });
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler o vídeo.')); };
    v.src = url;
  });
}

/**
 * Capa do vídeo: um quadro perto do começo, regravado em WebP. Serve de
 * `poster` no card e de miniatura no carrossel — sem ela, vídeo no meio das
 * fotos é um retângulo preto. Falha aqui não impede o post: devolve null e o
 * próprio <video> mostra o primeiro quadro que conseguir.
 */
async function posterDoVideo(v) {
  await new Promise((resolve, reject) => {
    // Com duração quebrada, o `currentTime` pode não mover nada e o `seeked`
    // nunca chega. Sem este prazo o "Enviando o vídeo…" ficaria para sempre.
    const prazo = setTimeout(() => reject(new Error('Demorou para ler o vídeo.')), 5000);
    v.onseeked = () => { clearTimeout(prazo); resolve(); };
    v.onerror = () => { clearTimeout(prazo); reject(new Error('Não foi possível ler o vídeo.')); };
    // 0,5 s evita o quadro preto com que muita câmera começa.
    v.currentTime = Math.min(0.5, (v.duration || 1) / 2);
  });
  return reduzir(v, VIDEO_POSTER_LADO, 0.8, v.videoWidth, v.videoHeight);
}

async function prepararVideo(file) {
  if (!VIDEO_TIPOS.includes(file.type)) throw new Error('O vídeo precisa ser MP4, WebM ou MOV.');
  if (file.size > VIDEO_BYTES_MAX) {
    throw new Error(`Vídeo acima de ${Math.round(VIDEO_BYTES_MAX / 1024 / 1024)} MB. Corte um trecho ou grave em qualidade menor.`);
  }
  const { v, url } = await carregarVideo(file);
  try {
    const dur = Number.isFinite(v.duration) ? v.duration : 0;
    if (dur > VIDEO_SEG_MAX) {
      throw new Error(`Vídeo de mais de ${Math.round(VIDEO_SEG_MAX / 60)} min. Corte um trecho mais curto.`);
    }
    const poster = await posterDoVideo(v).catch(() => null);
    return { width: v.videoWidth || 0, height: v.videoHeight || 0, dur: Math.round(dur), poster };
  } finally {
    URL.revokeObjectURL(url);
    v.removeAttribute('src');
    v.load();
  }
}

// ---- Subida -------------------------------------------------------------------

async function subir(path, f) {
  const { error } = await supabase.storage.from(BUCKET)
    .upload(path, f.blob, { contentType: f.type, cacheControl: CACHE_ARQUIVO });
  checar(error);
}

/**
 * Sobe as fotos e o vídeo para a pasta do colaborador e devolve o `midia` do
 * post, na ordem escolhida:
 *   foto:  { path, thumb?, width, height }        — `thumb` é a versão do feed
 *   vídeo: { tipo: 'video', path, poster?, width, height, dur }
 * Item sem `tipo` é foto, como nos posts anteriores a 26/10/2026. Se um
 * arquivo falhar, apaga os que já subiram.
 */
export async function subirMidias(colaboradorId, files = []) {
  const midia = [];
  const arquivos = []; // o que já subiu, para desfazer se algo falhar
  try {
    for (const file of files) {
      const base = `${colaboradorId}/${crypto.randomUUID()}`;
      if (ehVideo(file)) {
        const { width, height, dur, poster } = await prepararVideo(file);
        const item = { tipo: 'video', path: `${base}.${EXT_VIDEO[file.type]}`, width, height, dur };
        await subir(item.path, { blob: file, type: file.type });
        arquivos.push(item.path);
        if (poster) {
          item.poster = `${base}-poster.${poster.ext}`;
          await subir(item.poster, poster);
          arquivos.push(item.poster);
        }
        midia.push(item);
        continue;
      }
      const { grande, feed } = await prepararFoto(file);
      const item = { path: `${base}.${grande.ext}`, width: grande.width, height: grande.height };
      await subir(item.path, grande);
      arquivos.push(item.path);
      if (feed) {
        item.thumb = `${base}-feed.${feed.ext}`;
        await subir(item.thumb, feed);
        arquivos.push(item.thumb);
      }
      midia.push(item);
    }
    return midia;
  } catch (e) {
    if (arquivos.length) await supabase.storage.from(BUCKET).remove(arquivos);
    throw e;
  }
}

/** Todos os arquivos de um `midia` (foto: as duas versões; vídeo: ele e a capa). */
export const arquivosDaMidia = (midia = []) =>
  midia.flatMap((m) => [m.path, m.thumb, m.poster].filter(Boolean));

/** Apaga arquivos que subiram mas não viraram post (o post falhou). */
export async function apagarMidia(paths = []) {
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
}

// Links assinados guardados na sessão: o mesmo arquivo mantém o MESMO endereço
// enquanto o link vale, e o navegador reaproveita o que já baixou. Antes cada
// carregamento gerava link novo e baixava tudo de novo.
const CHAVE_LINKS = 'feed_links_v1';
const MARGEM_MS = 10 * 60 * 1000; // link a menos de 10 min de vencer é renovado
let links = null;
function cacheLinks() {
  if (links) return links;
  try { links = JSON.parse(sessionStorage.getItem(CHAVE_LINKS) || '{}'); } catch { links = {}; }
  return links;
}
function guardarLinks() {
  try { sessionStorage.setItem(CHAVE_LINKS, JSON.stringify(links)); } catch { /* sem espaço: segue só em memória */ }
}

/** Links assinados: { [path]: url }. Falha vira {} — o post mostra sem a mídia. */
export async function linksDaMidia(paths = []) {
  const agora = Date.now();
  const cache = cacheLinks();
  const out = {};
  const faltam = [];
  for (const p of new Set(paths)) {
    const c = cache[p];
    if (c && c.exp - agora > MARGEM_MS) out[p] = c.url;
    else faltam.push(p);
  }
  if (faltam.length) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(faltam, VALIDADE_LINK);
    if (!error) {
      const exp = agora + VALIDADE_LINK * 1000;
      for (const d of data || []) {
        if (!d.signedUrl) continue;
        out[d.path] = d.signedUrl;
        cache[d.path] = { url: d.signedUrl, exp };
      }
      // Limpa o que venceu, para o cache não crescer sem fim.
      for (const [p, c] of Object.entries(cache)) if (c.exp < agora) delete cache[p];
      guardarLinks();
    }
  }
  return out;
}

/** Mais curtidos dos últimos 7 dias, para a lateral da página. */
export async function destaquesDaSemana(limite = 3) {
  const { data, error } = await supabase.rpc('feed_destaques_semana', { p_limite: limite });
  checar(error);
  return data || [];
}

/**
 * Fotos de perfil de quem aparece no feed: { [colaborador_id]: url }. A Edge
 * Function só devolve quem tem post ou comentário visível (feed_autores) e a
 * própria pessoa. Falha vira {} — o avatar fica nas iniciais.
 */
export async function fotosDoFeed(ids = []) {
  if (!ids.length) return {};
  const { data, error } = await supabase.functions.invoke('fotos-aniversariantes', { body: { feed: ids } });
  if (error) return {};
  return data?.fotos || {};
}

// ---- Marcação e novidades ----------------------------------------------------

/** Pessoas para o "@": { id, nome, funcao }, no máximo 8. */
export async function buscarPessoas(termo) {
  const { data, error } = await supabase.rpc('feed_pessoas', { p_busca: termo });
  checar(error);
  return data || [];
}

/** Posts novos (de outras pessoas) desde a última visita ao feed. */
export async function novidadesDoFeed() {
  const { data, error } = await supabase.rpc('feed_novidades');
  if (error) return 0;
  return data || 0;
}

/** Abriu o feed: zera o contador do ícone. */
export async function marcarFeedVisto() {
  await supabase.rpc('feed_marcar_visto');
}

// ---- Regras de convivência (supabase_migration_feed_termos.sql) --------------

/** Aceite das regras de quem está logado: { versao, em } ou null se nunca aceitou. */
export async function termosAceitos() {
  const { data, error } = await supabase.rpc('feed_termos_aceite');
  checar(error);
  const a = data?.[0];
  return a?.em ? a : null;
}

/** Grava o aceite da versão lida; devolve { versao, em }. */
export async function aceitarTermos(versao) {
  const { data, error } = await supabase.rpc('feed_aceitar_termos', { p_versao: versao });
  checar(error);
  return { versao, em: data };
}

// Diretório do "@": baixado uma vez por sessão de página (138 pessoas em
// 20/10/2026) e filtrado na hora pela tela. Junto, se a pessoa pode @todos.
let diretorio = null;
export function diretorioDoFeed() {
  if (!diretorio) {
    diretorio = Promise.all([
      supabase.rpc('feed_diretorio'),
      supabase.rpc('feed_pode_marcar_todos'),
    ]).then(([d, t]) => {
      if (d.error) throw new Error(d.error.message);
      return { pessoas: d.data || [], podeTodos: t.data === true };
    }).catch((e) => { diretorio = null; throw e; });
  }
  return diretorio;
}
