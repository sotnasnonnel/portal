import { todayIso } from "./format.js";

export function makeKey() {
  return `it-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function newItem(order) {
  return {
    _key: makeKey(),
    qty: 1,
    description: "",
    item_date: todayIso(),
    value: "",
    nf_number: "",
    local: "",
    notes: "",
    nf_ref: null,
    sort_order: order,
  };
}

// Linhas de recibo que sao PEDACO do preco, nao produto: o recibo do Uber lista
// "Preco da viagem R$ 15,47" e "Custo fixo R$ 1,50" antes do "Total R$ 16,97".
// Lancar cada pedaco como um item punha a corrida duas vezes no reembolso.
const PARTES_DO_PRECO = [
  "PRECO DA VIAGEM", "PRECO DA CORRIDA", "TARIFA", "CUSTO FIXO", "TAXA",
  "SUBTOTAL", "ESPERA", "TEMPO DE ESPERA", "GORJETA", "DESCONTO", "PROMOCAO",
  "CUPOM", "PEDAGIO", "DINAMICA", "TOTAL",
];

const semAcento = (t) =>
  (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

/**
 * Recibo de servico (corrida de app e afins) vira UM item pelo total.
 *
 * Vale quando a nota e de corrida (categoria UBER) ou quando alguma linha e
 * claramente parte do preco. Sem `valor_total` nao mexe: o total e justamente
 * o numero que substitui as partes, e chutar a soma seria pior.
 */
function colapsarPartesDoPreco(itens, data) {
  const total = data?.valor_total != null ? Number(data.valor_total) : null;
  if (itens.length <= 1 || total == null || !Number.isFinite(total)) return itens;

  const categoria = semAcento(data?.categoria);
  const temParte = itens.some((it) =>
    PARTES_DO_PRECO.some((k) => semAcento(it.descricao).includes(k))
  );
  if (categoria !== "UBER" && !temParte) return itens;

  return [{ descricao: data?.categoria || itens[0].descricao || "SERVICO", valor: total }];
}

// Converte o JSON extraido de UMA nota em uma ou mais linhas (uma por item do
// cupom). Numero da NF, local, data, observacoes e a categoria da nota sao
// replicados em cada linha gerada.
export function itemsFromExtraction(data, startOrder) {
  const shared = {
    item_date: data?.data_nf || todayIso(),
    nf_number: data?.numero_nota ? String(data.numero_nota) : "",
    local: data?.local ? String(data.local) : "",
    notes: data?.observacoes ? String(data.observacoes) : "",
    meal_category: data?.categoria ? String(data.categoria) : "",
  };

  const itens = colapsarPartesDoPreco(
    Array.isArray(data?.itens)
      ? data.itens.filter((it) => it && (it.descricao || it.valor != null))
      : [],
    data
  );

  if (itens.length === 0) {
    const total = data?.valor_total != null ? Number(data.valor_total) : 0;
    return [
      {
        _key: makeKey(),
        qty: 1,
        description: String(data?.categoria || "").toUpperCase(),
        value: total ? String(total) : "",
        sort_order: startOrder,
        ...shared,
      },
    ];
  }

  return itens.map((it, idx) => ({
    _key: makeKey(),
    qty: 1,
    description: String(it.descricao || "").toUpperCase(),
    value: it.valor != null ? String(Number(it.valor)) : "",
    sort_order: startOrder + idx,
    ...shared,
  }));
}
