// Front-end: envia a imagem da NF para extracao e devolve os dados estruturados.
// A chave do Gemini NUNCA fica aqui — a chamada real acontece no servidor:
//   - DEV  : middleware do Vite (/api/extract-nf, le a chave do .env)
//   - PROD : Supabase Edge Function 'extract-nf' (chave fica nos secrets)
import { supabase } from "../lib/supabase.js";

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

/**
 * @param {string} dataUrl imagem da nota em data URL base64
 * @returns {Promise<{numero_nota,local,categoria,data_nf,itens,valor_total,observacoes}>}
 */
export async function extractNfFromDataUrl(dataUrl) {
  // PROD: chama a Edge Function via supabase-js (envia o JWT da sessão).
  if (!import.meta.env.DEV) {
    const { data, error } = await supabase.functions.invoke("extract-nf", {
      body: { dataUrl },
    });
    if (error) {
      // A função devolve { error } no corpo mesmo em status != 2xx.
      let message = "Não foi possível ler a nota.";
      try {
        const body = await error.context?.json?.();
        if (body?.error) message = body.error;
      } catch {
        /* mantém mensagem padrão */
      }
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }

  // DEV: middleware do Vite (server/extractNf.mjs lê a chave do .env).
  const res = await fetch("/api/extract-nf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl }),
  });

  if (!res.ok) {
    let message = "Não foi possível ler a nota.";
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* mantém mensagem padrão */
    }
    throw new Error(message);
  }

  return res.json();
}

/**
 * @param {File} file imagem da nota (jpg/png/webp)
 */
export async function extractNfFromFile(file) {
  const dataUrl = await fileToDataUrl(file);
  return extractNfFromDataUrl(dataUrl);
}
