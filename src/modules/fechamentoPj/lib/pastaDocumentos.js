// Abre a pasta compactada do prestador e extrai o texto dos PDFs.
// fflate e pdf.js entram sob demanda, como o SheetJS em lib/arquivos.js —
// são pesados e só o assistente de importação documental precisa deles.

import { analisarPasta } from './documentos.js';

const IGNORAR = /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db)/i;

async function descompactar(file) {
  // unzipSync e não unzip: a versão assíncrona do fflate monta o worker por
  // eval e cai em ambiente sem isso. Descompactar é rápido — o que demora é a
  // leitura dos PDFs, e essa já roda no worker do pdf.js.
  const { unzipSync } = await import('fflate');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const conteudo = unzipSync(bytes);
  return Object.entries(conteudo)
    .filter(([caminho, dados]) => !caminho.endsWith('/') && dados.length && !IGNORAR.test(caminho))
    .map(([caminho, dados]) => ({ caminho, dados }));
}

let pdfjsPromessa = null;

async function carregarPdfjs() {
  if (!pdfjsPromessa) {
    pdfjsPromessa = (async () => {
      const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
      const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    })();
  }
  return pdfjsPromessa;
}

/**
 * Texto de um PDF. Devolve '' quando o arquivo é uma digitalização (só imagem)
 * ou quando o pdf.js não consegue abrir — quem decide o que fazer é a análise.
 */
export async function textoDoPdf(dados) {
  const pdfjs = await carregarPdfjs();
  // Quem libera o worker é a tarefa de carga, não o documento — o proxy do
  // documento não tem destroy() e chamar lá dentro derrubaria toda a leitura.
  const tarefa = pdfjs.getDocument({
    data: dados.slice(), // o pdf.js assume o buffer; a cópia evita perder os bytes
    isEvalSupported: false,
    useSystemFonts: true,
    verbosity: 0,
  });
  try {
    const doc = await tarefa.promise;
    let texto = '';
    for (let p = 1; p <= doc.numPages; p += 1) {
      const pagina = await doc.getPage(p);
      const conteudo = await pagina.getTextContent();
      texto += `${conteudo.items.map((i) => i.str).join(' ')}\n`;
    }
    return texto.replace(/[ \t]+/g, ' ').trim();
  } catch {
    return '';
  } finally {
    await tarefa.destroy().catch(() => {});
  }
}

/**
 * Lê o ZIP inteiro e devolve a conferência pronta.
 * onProgresso({ feitos, total, arquivo }) acompanha a leitura, que é a parte demorada.
 */
export async function lerPastaDoPrestador(file, onProgresso) {
  if (!file) throw new Error('Selecione a pasta do prestador.');
  if (!/\.zip$/i.test(file.name)) throw new Error('Envie a pasta compactada no formato .zip.');

  let itens;
  try {
    itens = await descompactar(file);
  } catch {
    throw new Error('Não foi possível abrir o ZIP. Compacte a pasta de novo e tente outra vez.');
  }
  if (!itens.length) throw new Error('O ZIP está vazio.');

  const pdfs = itens.filter((i) => /\.pdf$/i.test(i.caminho));
  const lidos = [];
  for (let i = 0; i < pdfs.length; i += 1) {
    onProgresso?.({ feitos: i, total: pdfs.length, arquivo: pdfs[i].caminho.split('/').pop() });
    lidos.push({ caminho: pdfs[i].caminho, texto: await textoDoPdf(pdfs[i].dados) });
  }
  onProgresso?.({ feitos: pdfs.length, total: pdfs.length, arquivo: '' });

  const semTexto = itens.filter((i) => !/\.pdf$/i.test(i.caminho)).map((i) => ({ caminho: i.caminho, texto: '' }));
  return analisarPasta([...lidos, ...semTexto], file.name);
}
