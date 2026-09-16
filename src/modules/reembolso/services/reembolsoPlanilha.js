import { supabase } from "../lib/supabase.js";
import { paidAmount, STATUS_LABEL } from "./reimbursements.js";
import { formatBillable } from "../lib/format.js";
import { gravarXlsx } from "../../fechamentoPj/lib/arquivos.js";

/**
 * Planilha dos reembolsos para o Financeiro: uma aba com os pedidos e outra com
 * as despesas de cada um. Recebe os pedidos já carregados pela tela (a RLS já
 * decidiu o que a pessoa vê) e busca só os itens.
 */

const PAGINA = 1000; // limite de linhas por requisição do PostgREST
const LOTE_IDS = 150; // mantém a URL do filtro `in` num tamanho seguro

// Data sem hora (yyyy-mm-dd) vira data local — new Date("2026-09-01") seria
// meia-noite UTC e o Excel mostraria o dia anterior.
function dia(iso) {
  if (!iso) return "";
  const [a, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return a ? new Date(a, m - 1, d) : "";
}
const instante = (iso) => (iso ? new Date(iso) : "");
const num = (v) => (v == null || v === "" ? "" : Number(v));

async function buscarItens(ids) {
  const itens = [];
  for (let i = 0; i < ids.length; i += LOTE_IDS) {
    const lote = ids.slice(i, i + LOTE_IDS);
    for (let de = 0; ; de += PAGINA) {
      const { data, error } = await supabase
        .from("reembolso_items")
        .select("reimbursement_id, sort_order, qty, description, item_date, value, nf_number, local, notes, meal_category, is_accountability")
        .in("reimbursement_id", lote)
        .order("reimbursement_id")
        .order("sort_order")
        .range(de, de + PAGINA - 1);
      if (error) throw new Error(error.message);
      itens.push(...(data ?? []));
      if ((data ?? []).length < PAGINA) break;
    }
  }
  return itens;
}

export async function baixarPlanilhaReembolsos(pedidos) {
  const itens = await buscarItens(pedidos.map((r) => r.id));
  const porId = new Map(pedidos.map((r) => [r.id, r]));
  const tipo = (r) => (r.kind === "adiantamento" ? "Adiantamento" : "Reembolso");

  const abaPedidos = {
    nome: "Pedidos",
    cabecalho: [
      "Código", "Tipo", "Status", "Solicitante", "Gestor", "Cliente / Obra",
      "Reembolsável pelo cliente", "Data do pedido", "Valor total", "Valor aprovado",
      "Chave PIX", "Decidido por", "Decidido em", "Data de pagamento",
      "Observação da decisão", "Prestação de contas", "Total prestado", "Acerto", "Observações",
    ],
    linhas: pedidos.map((r) => [
      r.code ?? "", tipo(r), STATUS_LABEL[r.status] ?? r.status ?? "",
      r.requester_name ?? "", r.manager_name ?? "", r.client_obra ?? "",
      formatBillable(r.billable_to_client).replace("—", ""),
      dia(r.request_date), num(r.total), r.status === "aprovado" ? paidAmount(r) : num(r.approved_amount),
      r.pix_key ?? "", r.decided_by_name ?? "", instante(r.decided_at), dia(r.payment_date),
      r.decision_note ?? "", r.accountability_status ?? "", num(r.accountability_total),
      r.settlement ?? "", r.notes ?? "",
    ]),
    moeda: [8, 9, 16],
    data: [7, 12, 13],
    larguras: [14, 13, 20, 28, 28, 30, 12, 13, 14, 14, 24, 24, 13, 13, 30, 16, 14, 14, 40],
  };

  const abaDespesas = {
    nome: "Despesas",
    cabecalho: [
      "Código", "Tipo", "Status", "Solicitante", "Cliente / Obra", "Data da despesa",
      "Descrição", "Categoria", "Qtd", "Valor", "Nº NF", "Local", "Prestação de contas", "Observações",
    ],
    linhas: itens.map((it) => {
      const r = porId.get(it.reimbursement_id) ?? {};
      return [
        r.code ?? "", tipo(r), STATUS_LABEL[r.status] ?? r.status ?? "",
        r.requester_name ?? "", r.client_obra ?? "", dia(it.item_date),
        it.description ?? "", it.meal_category ?? "", num(it.qty), num(it.value),
        it.nf_number ?? "", it.local ?? "", it.is_accountability ? "Sim" : "", it.notes ?? "",
      ];
    }),
    moeda: [9],
    data: [5],
    larguras: [14, 13, 20, 28, 30, 13, 40, 16, 6, 14, 14, 24, 12, 40],
  };

  const hoje = new Date().toLocaleDateString("pt-BR").replaceAll("/", "-");
  await gravarXlsx([abaPedidos, abaDespesas], `Reembolsos ${hoje}.xlsx`);
}
