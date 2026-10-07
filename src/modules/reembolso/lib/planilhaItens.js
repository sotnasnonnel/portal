// Itens do reembolso vindos de uma planilha (pedido da Jakeline, 06/10/2026:
// no Excel ela arrasta as datas e copia os valores repetidos). A leitura do
// arquivo fica na tela; aqui só a conversão das linhas, que é o que tem regra.
import { makeKey } from "./nfCapture.js";
import { todayIso } from "./format.js";

// Cabeçalho do modelo, na mesma ordem das colunas do formulário.
export function colunasDoModelo(allowNf) {
  return allowNf
    ? ["QTD", "Item", "Data", "Valor (R$)", "Nº NF", "Local", "Observações"]
    : ["QTD", "Item", "Valor (R$)", "Observações"];
}

const normal = (t) =>
  String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Nome de coluna -> campo do item. Aceita o modelo e as variações comuns de
// quem já tinha a própria planilha.
function campoDaColuna(titulo) {
  const t = normal(titulo);
  if (!t) return null;
  if (/^(qtd|qtde|quant)/.test(t)) return "qty";
  if (/^(item|descri|despesa|produto)/.test(t)) return "description";
  if (/^data/.test(t)) return "item_date";
  if (/^(valor|preco|vlr)/.test(t)) return "value";
  if (/(^|\s)(nf|nota)/.test(t) || /^n[ºo°.]?\s*(da\s*)?n/.test(t)) return "nf_number";
  if (/^(local|estabelecimento|fornecedor)/.test(t)) return "local";
  if (/^obs/.test(t)) return "notes";
  return null;
}

// Procura o cabeçalho nas primeiras linhas: a planilha pode ter um título em
// cima. Sem cabeçalho reconhecível, vale a ordem do modelo.
function acharCabecalho(linhas, allowNf) {
  for (let i = 0; i < Math.min(linhas.length, 10); i += 1) {
    const mapa = {};
    (linhas[i] || []).forEach((cel, col) => {
      const campo = campoDaColuna(cel);
      if (campo && mapa[campo] == null) mapa[campo] = col;
    });
    if (mapa.description != null && mapa.value != null) return { inicio: i + 1, mapa };
  }
  const mapa = {};
  colunasDoModelo(allowNf).forEach((titulo, col) => { mapa[campoDaColuna(titulo)] = col; });
  return { inicio: 0, mapa };
}

const SERIAL_ZERO = Date.UTC(1899, 11, 30);

// Célula de data -> "yyyy-mm-dd". O Excel guarda data como número de dias
// (série); digitada como texto, vem dd/mm/aaaa.
export function dataDaCelula(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const p = (n) => String(n).padStart(2, "0");
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  if (typeof v === "number" && v > 0) {
    return new Date(SERIAL_ZERO + Math.floor(v) * 86400000).toISOString().slice(0, 10);
  }
  const t = String(v ?? "").trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) {
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${ano}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

// Célula de valor -> número. Texto vem no jeito brasileiro: "R$ 1.234,56".
export function valorDaCelula(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let t = String(v ?? "").replace(/r\$|\s/gi, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const texto = (v) => String(v ?? "").trim();
const LINHA_DE_TOTAL = /^(sub)?total\b/;

/**
 * Linhas da planilha (matriz, como o SheetJS devolve com header: 1) -> itens
 * do formulário. Linha sem descrição fica de fora: em planilha de gasto é a
 * linha do total ou uma linha solta. Devolve também quantas foram ignoradas,
 * para a tela contar à pessoa.
 */
export function itensDaPlanilha(linhas, { allowNf = true, ordemInicial = 0 } = {}) {
  const { inicio, mapa } = acharCabecalho(linhas || [], allowNf);
  const cel = (linha, campo) => (mapa[campo] == null ? "" : linha[mapa[campo]]);
  const itens = [];
  let ignoradas = 0;

  for (const linha of (linhas || []).slice(inicio)) {
    if (!linha || linha.every((c) => texto(c) === "")) continue;
    const descricao = texto(cel(linha, "description")).toUpperCase();
    if (!descricao || LINHA_DE_TOTAL.test(normal(descricao))) { ignoradas += 1; continue; }

    const valor = valorDaCelula(cel(linha, "value"));
    const qtd = Math.round(Number(valorDaCelula(cel(linha, "qty"))));
    itens.push({
      _key: makeKey(),
      qty: qtd >= 1 ? qtd : 1,
      description: descricao,
      item_date: (allowNf && dataDaCelula(cel(linha, "item_date"))) || todayIso(),
      value: valor == null ? "" : String(Math.round(valor * 100) / 100),
      nf_number: allowNf ? texto(cel(linha, "nf_number")) : "",
      local: allowNf ? texto(cel(linha, "local")) : "",
      notes: texto(cel(linha, "notes")),
      nf_ref: null,
      sort_order: ordemInicial + itens.length,
    });
  }
  return { itens, ignoradas };
}
