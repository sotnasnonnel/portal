import { supabase } from './supabase';
import { carregarImagem, reduzir } from './feed';
import { ANEXO_BYTES_MAX, POR_PAGINA, blocoVazio, normalizarUrl } from '../config/avisos';

// Avisos do portal. Tudo por RPC (supabase/supabase_migration_avisos.sql): a
// tabela não tem policy, então o banco decide quem lê, publica e apaga.
// Fotos e anexos vão para o bucket privado avisos-midia, na pasta de quem
// publica, e são lidos por link assinado.

const BUCKET = 'avisos-midia';
const VALIDADE_LINK = 60 * 60; // 1 h
const CACHE_ARQUIVO = '31536000'; // nome é UUID novo a cada envio: nunca muda
const LADO_FOTO = 1920;

function checar(error) {
  if (error) throw new Error(error.message || 'Falha ao falar com o banco.');
}

export async function listarAvisos({ cursor = null, limite = POR_PAGINA } = {}) {
  const { data, error } = await supabase.rpc('avisos_listar', {
    p_cursor_em: cursor?.em ?? null, p_cursor_id: cursor?.id ?? null, p_limite: limite,
  });
  checar(error);
  return data || [];
}

/** O aviso inteiro, ou null se não existe (ou foi apagado). */
export async function obterAviso(id) {
  const { data, error } = await supabase.rpc('avisos_obter', { p_id: id });
  checar(error);
  return data?.[0] || null;
}

export async function excluirAviso(id) {
  const { error } = await supabase.rpc('avisos_excluir', { p_id: id });
  checar(error);
}

// ---- Arquivos -------------------------------------------------------------------

async function subir(path, blob, type) {
  const { error } = await supabase.storage.from(BUCKET)
    .upload(path, blob, { contentType: type, cacheControl: CACHE_ARQUIVO });
  checar(error);
}

/** Foto reduzida a 1920px em WebP. GIF sobe como veio, para não perder a animação. */
async function subirFoto(pasta, file) {
  const img = await carregarImagem(file);
  if (file.type === 'image/gif') {
    const path = `${pasta}/${crypto.randomUUID()}.gif`;
    await subir(path, file, file.type);
    return { path, width: img.naturalWidth, height: img.naturalHeight };
  }
  const f = await reduzir(img, LADO_FOTO, 0.85);
  const path = `${pasta}/${crypto.randomUUID()}.${f.ext}`;
  await subir(path, f.blob, f.type);
  return { path, width: f.width, height: f.height };
}

async function subirAnexo(pasta, file) {
  if (file.size > ANEXO_BYTES_MAX) {
    throw new Error(`"${file.name}" passa de ${Math.round(ANEXO_BYTES_MAX / 1024 / 1024)} MB.`);
  }
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${pasta}/${crypto.randomUUID()}.${ext}`;
  await subir(path, file, file.type || 'application/octet-stream');
  return { path, nome: file.name, tamanho: file.size };
}

/**
 * Publica (sem `id`) ou edita um aviso. O que foi escolhido agora (`foto.arquivo`,
 * `bloco.arquivo`) sobe antes, na pasta de quem salva; se o banco recusar,
 * os arquivos que acabaram de subir são apagados.
 */
export async function salvarAviso(colaboradorId, { id = null, manchete, subtitulo, fundo, foto, blocos }) {
  const subidos = [];
  try {
    let fotoPath = null;
    if (fundo === 'foto') {
      if (foto?.arquivo) {
        fotoPath = (await subirFoto(colaboradorId, foto.arquivo)).path;
        subidos.push(fotoPath);
      } else {
        fotoPath = foto?.path || null;
      }
    }

    const saida = [];
    for (const b of blocos) {
      if (blocoVazio(b)) continue;
      if (b.tipo === 'texto') { saida.push({ tipo: 'texto', texto: b.texto }); continue; }
      if (b.tipo === 'botao') {
        saida.push({ tipo: 'botao', rotulo: b.rotulo.trim(), url: normalizarUrl(b.url) });
        continue;
      }
      if (b.tipo === 'imagem') {
        const arq = b.arquivo ? await subirFoto(colaboradorId, b.arquivo) : { path: b.path, width: b.width, height: b.height };
        if (b.arquivo) subidos.push(arq.path);
        saida.push({ tipo: 'imagem', ...arq, legenda: (b.legenda || '').trim() });
        continue;
      }
      if (b.tipo === 'anexo') {
        const arq = b.arquivo ? await subirAnexo(colaboradorId, b.arquivo) : { path: b.path, nome: b.nome, tamanho: b.tamanho };
        if (b.arquivo) subidos.push(arq.path);
        saida.push({ tipo: 'anexo', ...arq });
      }
    }

    const { data, error } = await supabase.rpc('avisos_salvar', {
      p_id: id, p_manchete: manchete.trim(), p_subtitulo: (subtitulo || '').trim(),
      p_fundo: fundo, p_foto_path: fotoPath, p_blocos: saida,
    });
    checar(error);
    return data;
  } catch (e) {
    if (subidos.length) await supabase.storage.from(BUCKET).remove(subidos);
    throw e;
  }
}

// Links assinados guardados na sessão, como no Feed: o mesmo arquivo mantém o
// mesmo endereço enquanto o link vale, e o navegador reaproveita o download.
const CHAVE_LINKS = 'avisos_links_v1';
const MARGEM_MS = 10 * 60 * 1000;
let links = null;
function cacheLinks() {
  if (links) return links;
  try { links = JSON.parse(sessionStorage.getItem(CHAVE_LINKS) || '{}'); } catch { links = {}; }
  return links;
}
function guardarLinks() {
  try { sessionStorage.setItem(CHAVE_LINKS, JSON.stringify(links)); } catch { /* segue só em memória */ }
}

/** Links assinados: { [path]: url }. Falha vira {} — o aviso aparece sem a imagem. */
export async function linksDosArquivos(paths = []) {
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
      for (const [p, c] of Object.entries(cache)) if (c.exp < agora) delete cache[p];
      guardarLinks();
    }
  }
  return out;
}

/** Link de download do anexo, com o nome original do arquivo. */
export async function linkDeDownload(path, nome) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60, { download: nome || true });
  checar(error);
  return data.signedUrl;
}
