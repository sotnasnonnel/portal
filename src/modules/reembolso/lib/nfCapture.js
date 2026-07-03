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

  const itens = Array.isArray(data?.itens)
    ? data.itens.filter((it) => it && (it.descricao || it.valor != null))
    : [];

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
