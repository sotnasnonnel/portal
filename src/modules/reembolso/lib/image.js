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
