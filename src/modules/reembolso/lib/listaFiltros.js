/**
 * Busca e ordenação da lista de reembolsos (Cliente / Obra, Solicitante, Data).
 * Lógica pura, testada em listaFiltros.test.js.
 */

// Sem acento e sem caixa: "São José" acha "sao jose".
function normalizar(v) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Valores distintos de um campo, para a lista suspensa. Obra é digitada à mão:
// "Obra X" e "obra x " viram uma opção só (fica a primeira grafia).
function distintos(rows, campo) {
  const vistos = new Map();
  for (const r of rows) {
    const valor = String(r[campo] ?? "").trim();
    const chave = normalizar(valor);
    if (chave && !vistos.has(chave)) vistos.set(chave, valor);
  }
  return [...vistos.values()].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
}

/** Opções das listas suspensas de Cliente / Obra e Solicitante. */
export function opcoesDaLista(rows) {
  return {
    obras: distintos(rows, "client_obra"),
    solicitantes: distintos(rows, "requester_name"),
  };
}

/**
 * `busca`: { obra, solicitante, de, ate }. Obra e solicitante vêm da lista
 * suspensa e batem pelo valor inteiro (sem acento e sem caixa, como nas
 * opções). Datas em "AAAA-MM-DD", comparadas com a data do pedido
 * (request_date), inclusive nas duas pontas. Campo vazio não filtra.
 */
export function filtrarLista(rows, busca = {}) {
  const obra = normalizar(busca.obra);
  const solicitante = normalizar(busca.solicitante);
  const { de, ate } = busca;
  return rows.filter((r) => {
    if (obra && normalizar(r.client_obra) !== obra) return false;
    if (solicitante && normalizar(r.requester_name) !== solicitante) return false;
    const data = String(r.request_date ?? "").slice(0, 10);
    if (de && (!data || data < de)) return false;
    if (ate && (!data || data > ate)) return false;
    return true;
  });
}

export const COLUNAS_ORDEM = {
  solicitante: "requester_name",
  obra: "client_obra",
  data: "request_date",
};

/** Ordena sem mexer no array original. Vazio vai sempre para o fim. */
export function ordenarLista(rows, ordem) {
  const campo = ordem && COLUNAS_ORDEM[ordem.coluna];
  if (!campo) return rows;
  const sinal = ordem.direcao === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const va = a[campo] ?? "";
    const vb = b[campo] ?? "";
    if (!va && !vb) return 0;
    if (!va) return 1;
    if (!vb) return -1;
    return sinal * String(va).localeCompare(String(vb), "pt-BR", { sensitivity: "base" });
  });
}

/** Clique no cabeçalho: crescente → decrescente → sem ordem. */
export function proximaOrdem(atual, coluna) {
  if (!atual || atual.coluna !== coluna) return { coluna, direcao: "asc" };
  if (atual.direcao === "asc") return { coluna, direcao: "desc" };
  return null;
}
