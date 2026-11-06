import { supabase } from '../../../services/supabase';
import { LIMITE_ANEXO, tipoDoArquivo } from './regras';

/**
 * Faturas, boletos e comprovantes dos lançamentos de pagamento. Mesmo formato
 * dos anexos da Frota (src/modules/frota/lib/frota.js): o arquivo vai para o
 * bucket privado e o registro guarda [{path, nome, tipo, tamanho, enviado_em}]
 * no jsonb `anexos`. Bucket próprio porque a RLS de cada módulo é separada.
 */
export const BUCKET_ALOJ = 'alojamentos-anexos';

export async function enviarAnexo(file) {
  const tipo = tipoDoArquivo(file);
  if (!tipo) throw new Error(`${file.name}: formato não aceito. Envie PDF, PNG ou JPG.`);
  if (file.size > LIMITE_ANEXO) throw new Error(`${file.name}: acima de 20 MB.`);
  const nomeSeguro = String(file.name).normalize('NFD').replace(/[^\w.-]+/g, '_');
  const path = `pagamentos/${crypto.randomUUID()}-${nomeSeguro}`;
  const { error } = await supabase.storage.from(BUCKET_ALOJ).upload(path, file, { contentType: tipo });
  if (error) throw new Error(`${file.name}: não foi possível enviar (${error.message}).`);
  return {
    path, nome: file.name, tipo, tamanho: file.size, enviado_em: new Date().toISOString(),
  };
}

/** Bucket privado: o arquivo só abre por URL assinada, que vence em 2 minutos. */
export async function urlDoAnexo(path, opcoes) {
  const { data, error } = await supabase.storage.from(BUCKET_ALOJ).createSignedUrl(path, 120, opcoes);
  if (error) throw new Error(`Não foi possível abrir o anexo: ${error.message}`);
  return data.signedUrl;
}

/** Não bloqueia a tela: o registro já foi gravado, sobra no máximo um arquivo órfão. */
export async function removerAnexos(paths) {
  if (!paths?.length) return;
  const { error } = await supabase.storage.from(BUCKET_ALOJ).remove(paths);
  if (error) console.warn('Alojamentos: anexo não removido do bucket', error.message);
}
