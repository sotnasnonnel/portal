// Leitura de planilha enviada pelo usuário (relatórios das plataformas e Cobli).
// `xlsx` entra por import dinâmico, como na exportação: pesa e só é usado aqui.
// Devolve as abas como matrizes de células já em texto/número, com data em
// dd/mm/aaaa, para as regras puras (cobli.js, importacao.js) não verem a lib.

export const EXT_PLANILHA = ['csv', 'xlsx', 'xls', 'ods', 'xlsm'];

export const extensaoDe = (nome) => String(nome || '').split('.').pop().toLowerCase();
export const ehPlanilha = (nome) => EXT_PLANILHA.includes(extensaoDe(nome));

const pad2 = (n) => String(n).padStart(2, '0');
const celula = (v) => (v instanceof Date && !Number.isNaN(v.getTime())
  ? `${pad2(v.getDate())}/${pad2(v.getMonth() + 1)}/${v.getFullYear()}`
  : v);

/** CSV vem de Excel brasileiro em windows-1252 com frequência: tenta UTF-8 estrito antes. */
function decodificar(buf) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('windows-1252').decode(buf);
  }
}

/** Separador do CSV: `;` quando a primeira linha tem mais `;` que `,`. */
export function separadorDoCsv(texto) {
  const primeira = String(texto).split(/\r?\n/, 1)[0] || '';
  return (primeira.match(/;/g) || []).length > (primeira.match(/,/g) || []).length ? ';' : ',';
}

/**
 * Lê um File/Blob (ou ArrayBuffer com `nome`) e devolve
 * { abas: [{ nome, linhas: any[][] }] }. Linha vazia fica como [].
 */
export async function lerPlanilha(arquivo, nome = arquivo?.name) {
  const XLSX = await import('xlsx');
  const buf = arquivo instanceof ArrayBuffer ? arquivo : await arquivo.arrayBuffer();
  let wb;
  if (extensaoDe(nome) === 'csv' || extensaoDe(nome) === 'txt') {
    const texto = decodificar(buf);
    wb = XLSX.read(texto, { type: 'string', FS: separadorDoCsv(texto), cellDates: true, raw: false });
  } else {
    wb = XLSX.read(buf, { type: 'array', cellDates: true });
  }
  return {
    abas: wb.SheetNames.map((n) => ({
      nome: n,
      linhas: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '', raw: true, blankrows: true })
        .map((linha) => linha.map(celula)),
    })),
  };
}

/** Letra da coluna no estilo do Excel: 0 -> A, 25 -> Z, 26 -> AA. */
export function letraDaColuna(i) {
  let n = i + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
