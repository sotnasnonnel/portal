import { pedacosComLinks } from './feed.js';
import { isSuperAdmin } from './superAdmin.js';

// Avisos do portal (/avisos): notícias internas no molde do SharePoint da
// Comunicação, com o banner do "TEMPLATE MANCHETE COMUNICAÇÃO INTERNA.pptx".
// Todo colaborador ativo publica; as regras finais estão no banco
// (supabase/supabase_migration_avisos.sql).

export const ROTA_AVISOS = '/avisos';

export const MANCHETE_MAX = 160;
export const SUBTITULO_MAX = 160;
export const TEXTO_MAX = 5000;
export const LEGENDA_MAX = 200;
export const ROTULO_MAX = 60;
export const BLOCOS_MAX = 40;
export const ANEXO_BYTES_MAX = 20 * 1024 * 1024;
export const POR_PAGINA = 12;

// Quem edita e exclui aviso dos outros: só o super admin (o banco usa
// app_private.avisos_moderador()). O autor sempre pode mexer no próprio.
export const ehModeradorAvisos = (user) => isSuperAdmin(user);

export const FUNDOS = [
  { valor: 'laranja', rotulo: 'Laranja' },
  { valor: 'azul', rotulo: 'Azul' },
  { valor: 'foto', rotulo: 'Foto' },
];

export const TIPOS_BLOCO = {
  texto: 'Texto',
  imagem: 'Imagem',
  botao: 'Botão',
  anexo: 'Anexo',
};

export const blocoNovo = (tipo) => ({
  texto: { tipo: 'texto', texto: '' },
  imagem: { tipo: 'imagem', path: '', legenda: '' },
  botao: { tipo: 'botao', rotulo: '', url: '' },
  anexo: { tipo: 'anexo', path: '', nome: '' },
}[tipo]);

/** Só http(s) ou caminho do portal ("/feed"): o banco recusa o resto. */
export const urlValida = (url = '') => /^(https?:\/\/|\/)/i.test(String(url).trim());

/**
 * "www.site.com" vira "https://www.site.com", para a pessoa não ter de saber
 * que o botão exige o protocolo. Caminho do portal ("/feed") fica como está.
 */
export function normalizarUrl(url = '') {
  const u = String(url).trim();
  if (!u || urlValida(u)) return u;
  return `https://${u}`;
}

/**
 * Bloco tem arquivo quando já subiu (`path`) ou quando foi escolhido agora e
 * sobe ao salvar (`arquivo`, um File).
 */
const temArquivo = (b) => Boolean(b.path || b.arquivo);

/** Bloco que não diz nada é descartado ao salvar, em vez de travar o envio. */
export function blocoVazio(b) {
  if (b.tipo === 'texto') return !String(b.texto || '').trim();
  if (b.tipo === 'botao') return !String(b.rotulo || '').trim() && !String(b.url || '').trim();
  return !temArquivo(b);
}

/** '' quando dá para publicar, ou a mensagem do primeiro problema. */
export function validarAviso({ manchete = '', subtitulo = '', fundo = 'laranja', foto = null, blocos = [] } = {}) {
  const m = manchete.trim();
  if (!m) return 'Escreva a manchete do aviso.';
  if (m.length > MANCHETE_MAX) return `A manchete passa de ${MANCHETE_MAX} caracteres.`;
  if (subtitulo.trim().length > SUBTITULO_MAX) return `O subtítulo passa de ${SUBTITULO_MAX} caracteres.`;
  if (fundo === 'foto' && !foto) return 'Escolha a foto do fundo, ou troque o fundo para laranja ou azul.';
  const uteis = blocos.filter((b) => !blocoVazio(b));
  if (uteis.length > BLOCOS_MAX) return `Até ${BLOCOS_MAX} blocos por aviso.`;
  for (const b of uteis) {
    if (b.tipo === 'texto' && b.texto.length > TEXTO_MAX) return `Bloco de texto com mais de ${TEXTO_MAX} caracteres.`;
    if (b.tipo === 'imagem' && (b.legenda || '').length > LEGENDA_MAX) return `Legenda com mais de ${LEGENDA_MAX} caracteres.`;
    if (b.tipo === 'botao') {
      const rotulo = (b.rotulo || '').trim();
      if (!rotulo) return 'Dê um texto ao botão (ex.: "Acessar nosso portal").';
      if (rotulo.length > ROTULO_MAX) return `O texto do botão passa de ${ROTULO_MAX} caracteres.`;
      if (!urlValida(normalizarUrl(b.url))) return `Informe o link do botão "${rotulo}".`;
    }
  }
  return '';
}

/**
 * Tamanho da manchete no banner. O template foi desenhado para duas linhas;
 * manchete longa encolhe para caber no cartão em vez de vazar dele.
 */
export function tamanhoManchete(manchete = '') {
  const n = semMarcas(manchete).length;
  if (n <= 45) return 'g';
  if (n <= 80) return 'm';
  return 'p';
}

// ---- Formatação simples --------------------------------------------------------
// Sem editor de HTML: o texto guarda marcas que qualquer um digita, e o front
// as desenha como elementos React — nunca como HTML cru.
//   **negrito**   _itálico_   - item de lista   1. item numerado   ## subtítulo

// O "_" só marca itálico fora de palavra: "arquivo_final_v2" e links com "_"
// ficam como estão.
const RE_MARCA = /\*\*(.+?)\*\*|(?<![\p{L}\p{N}_/])_(.+?)_(?![\p{L}\p{N}_])/gu;

/** Texto sem as marcas, para contar caracteres e para resumos. */
export const semMarcas = (texto = '') => String(texto).replace(RE_MARCA, (_, b, i) => b ?? i);

/**
 * Pedaços de uma linha: [{ texto, negrito?, italico?, link?, href? }].
 * Links dentro do trecho marcado também viram link.
 */
export function pedacosFormatados(linha = '') {
  const out = [];
  let i = 0;
  const empurrar = (texto, estilo = {}) => {
    for (const p of pedacosComLinks(texto)) out.push({ ...p, ...estilo });
  };
  for (const m of String(linha).matchAll(RE_MARCA)) {
    if (m.index > i) empurrar(linha.slice(i, m.index));
    if (m[1] !== undefined) empurrar(m[1], { negrito: true });
    else empurrar(m[2], { italico: true });
    i = m.index + m[0].length;
  }
  if (i < linha.length) empurrar(linha.slice(i));
  return out;
}

/**
 * Texto do bloco em partes: [{ tipo: 'p', linhas[] } | { tipo: 'ul'|'ol', itens[] }
 * | { tipo: 'h', texto }]. Linha em branco separa parágrafos; linhas
 * seguidas do mesmo parágrafo viram quebra de linha.
 */
export function blocosDoTexto(texto = '') {
  const out = [];
  let atual = null;
  for (const bruta of String(texto).replace(/\r\n?/g, '\n').split('\n')) {
    const linha = bruta.trimEnd();
    const ul = /^\s*[-•*]\s+(.*)$/.exec(linha);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(linha);
    const h = /^\s*##\s+(.*)$/.exec(linha);
    if (!linha.trim()) { atual = null; continue; }
    if (h) { out.push({ tipo: 'h', texto: h[1] }); atual = null; continue; }
    const tipo = ul ? 'ul' : ol ? 'ol' : 'p';
    if (!atual || atual.tipo !== tipo) {
      atual = tipo === 'p' ? { tipo, linhas: [] } : { tipo, itens: [] };
      out.push(atual);
    }
    if (tipo === 'p') atual.linhas.push(linha);
    else atual.itens.push((ul || ol)[1]);
  }
  return out;
}

/**
 * Aplica uma marca na seleção de um <textarea>: devolve o texto novo e onde a
 * seleção fica. Sem seleção, insere a marca vazia com o cursor no meio.
 */
export function aplicarMarca(texto, ini, fim, marca) {
  const sel = texto.slice(ini, fim);
  const novo = `${texto.slice(0, ini)}${marca}${sel}${marca}${texto.slice(fim)}`;
  return { texto: novo, ini: ini + marca.length, fim: fim + marca.length };
}

/** Põe (ou tira) um prefixo de linha — "- ", "1. ", "## " — nas linhas da seleção. */
export function prefixarLinhas(texto, ini, fim, prefixo) {
  const comeco = texto.lastIndexOf('\n', ini - 1) + 1;
  const fimLinha = texto.indexOf('\n', fim);
  const ate = fimLinha === -1 ? texto.length : fimLinha;
  const linhas = texto.slice(comeco, ate).split('\n');
  const numerado = prefixo === '1. ';
  const re = numerado ? /^\d+\.\s/ : new RegExp(`^${prefixo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
  const todas = linhas.every((l) => re.test(l));
  const novas = linhas.map((l, k) => {
    if (todas) return l.replace(re, '');
    return `${numerado ? `${k + 1}. ` : prefixo}${l}`;
  });
  const trecho = novas.join('\n');
  return { texto: texto.slice(0, comeco) + trecho + texto.slice(ate), ini: comeco, fim: comeco + trecho.length };
}

// ---- Arquivos -------------------------------------------------------------------

export const tamanhoLegivel = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
};

export const ANEXO_ACCEPT = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv',
  '.png', '.jpg', '.jpeg', '.webp', '.gif',
].join(',');
export const IMAGEM_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

/** Caminhos do bucket que um aviso usa (para pedir os links assinados). */
export const arquivosDoAviso = (aviso = {}) => [
  aviso.foto_path,
  ...(aviso.blocos || []).filter((b) => b.tipo === 'imagem' || b.tipo === 'anexo').map((b) => b.path),
].filter(Boolean);
