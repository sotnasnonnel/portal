// Compressao de imagem no cliente: redimensiona e re-encoda em JPEG.
// Reduz o tamanho armazenado/trafegado (menos custo de tokens no Gemini e
// menos peso no storage) e normaliza tudo para JPEG (facilita o embed no PDF).

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao carregar a imagem."));
    img.src = src;
  });
}

/**
 * @param {File} file
 * @returns {Promise<string>} dataUrl JPEG comprimido
 */
export async function compressImageToDataUrl(file, { maxSize = 1600, quality = 0.72 } = {}) {
  const original = await readAsDataUrl(file);
  if (!file.type?.startsWith("image/")) return original; // nao-imagem: devolve como veio

  const img = await loadImage(original);
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

// ============================ Anexos aceitos ============================

/**
 * O que o seletor de arquivo aceita. PDF entra junto das imagens porque muita
 * nota chega assim: cupom de aplicativo, NFS-e e recibo de hotel vêm em PDF do
 * e-mail, e antes a pessoa precisava printar a tela para conseguir anexar.
 * O Gemini lê PDF pelo mesmo caminho da imagem (inline_data).
 */
export const ANEXO_ACCEPT = "image/*,application/pdf";

/** Mime de um dataUrl ("data:application/pdf;base64,..." -> "application/pdf"). */
export function mimeFromDataUrl(dataUrl) {
  return /^data:(.*?);base64/.exec(String(dataUrl || ""))?.[1] || "";
}

/**
 * O anexo é PDF? Aceita tanto o que ainda está no formulário (dataUrl) quanto
 * o que já foi salvo (storage_path/url do bucket).
 */
export function isPdfAnexo(img) {
  if (!img) return false;
  if (img.dataUrl) return mimeFromDataUrl(img.dataUrl) === "application/pdf";
  const alvo = img.storage_path || img.ref?.value || img.url || "";
  return /\.pdf(\?|$)/i.test(String(alvo));
}
