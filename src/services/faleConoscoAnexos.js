import { supabase } from './supabase';
import { enviarArquivo } from '../pages/Gestor/requisicoes/uploadAnexo';
import { ANEXOS_FC } from '../config/suporte';

// Anexos do Fale conosco. O bucket é privado e a policy confere o dono pela
// primeira pasta do caminho (<colaborador_id>/...), por isso o upload sempre
// vai para a pasta de quem escreve.

/**
 * Sobe os arquivos e devolve [{ path, nome }]. Se um falhar, apaga os que já
 * subiram e relança o erro — a mensagem não sai com metade dos anexos.
 */
export async function enviarAnexosFaleConosco(autorId, arquivos) {
  const enviados = [];
  try {
    for (const file of arquivos) {
      enviados.push(await enviarArquivo(ANEXOS_FC.bucket, file, autorId));
    }
    return enviados;
  } catch (e) {
    await descartarAnexosFaleConosco(enviados);
    throw e;
  }
}

/** Rollback: a mensagem não foi gravada, então os arquivos não têm dono. */
export async function descartarAnexosFaleConosco(anexos) {
  if (!anexos?.length) return;
  const { error } = await supabase.storage.from(ANEXOS_FC.bucket).remove(anexos.map((a) => a.path));
  if (error) console.warn('[fale-conosco-anexos] rollback falhou:', error.message);
}

/**
 * URLs assinadas de vários anexos numa chamada só: { path -> url }. Um path que
 * a pessoa não pode ler volta sem URL, e o anexo aparece sem link, sem quebrar
 * a lista.
 */
export async function urlsAnexosFaleConosco(paths, segundos = 3600) {
  if (!paths.length) return {};
  const { data, error } = await supabase.storage.from(ANEXOS_FC.bucket).createSignedUrls(paths, segundos);
  if (error) {
    console.warn('[fale-conosco-anexos] URLs assinadas:', error.message);
    return {};
  }
  return Object.fromEntries((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
}

export const ehImagem = (nome) => /\.(png|jpe?g|webp)$/i.test(nome || '');
