// Storage das imagens de NF no Supabase (bucket PRIVADO -> URLs assinadas).

import { supabase } from "../lib/supabase.js";

export const NF_BUCKET = "reembolso-nf";

function dataUrlToBlob(dataUrl) {
  const [meta, b64] = dataUrl.split(",");
  const mime = /data:(.*?);base64/.exec(meta)?.[1] || "image/jpeg";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Sobe a imagem e devolve o caminho (path) dentro do bucket. */
export async function uploadNfImage(dataUrl, { reimbursementId, index = 0 } = {}) {
  const blob = dataUrlToBlob(dataUrl);
  const path = `${reimbursementId}/${Date.now()}-${index}.jpg`;
  const { error } = await supabase.storage
    .from(NF_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`Storage: ${error.message}`);
  return path;
}

/** URL assinada temporária (bucket é privado). */
export async function signedUrl(path, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from(NF_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) throw new Error(`Storage signedUrl: ${error.message}`);
  return data.signedUrl;
}

/** Remove arquivos do bucket (limpeza ao excluir reembolso). */
export async function removeNfImages(paths) {
  if (!paths?.length) return;
  await supabase.storage.from(NF_BUCKET).remove(paths);
}

/**
 * Resolve uma ref para dataUrl (usado pra embutir no PDF).
 * ref = { kind: 'url' | 'dataurl', value }
 */
export async function refToDataUrl(ref) {
  if (!ref) return null;
  if (ref.kind === "dataurl") return ref.value;
  const res = await fetch(ref.value);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Falha ao baixar a imagem da NF."));
    reader.readAsDataURL(blob);
  });
}
