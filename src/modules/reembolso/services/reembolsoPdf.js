// Gera o PDF do reembolso aprovado: cabecalho + tabela de itens + uma pagina
// por imagem de NF anexada. Nome do arquivo no padrao definido pelo cliente:
//   ano.mes(competencia)_ano.mes.dia(pagamento)_PHDA_NomeCompleto_REEMBSN_R$valor
//   ex: 2026.04_2026.05.08_PHDA_LennonSantos_REEMBSN_R$2000,00.pdf

import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { formatCurrency, formatDate } from "../lib/format.js";
import { computePaymentDate } from "../lib/reimbursementPolicy.js";
import { STATUS_LABEL } from "./reimbursements.js";
import { refToDataUrl } from "./nfStorage.js";

const FIXO_EMPRESA = "PHDA";
const FIXO_TIPO = "REEMBSN";

// Data de pagamento efetiva: usa a salva no banco e, para registros antigos
// (aprovados antes da regra automática), recalcula a partir da aprovação.
function effectivePaymentDate(r) {
  return r.payment_date || computePaymentDate(r.decided_at);
}

// Valor efetivamente aprovado/pago: o aprovado (com ou sem desconto) ou, na
// falta dele (registros antigos), o total cheio.
function paidAmount(r) {
  return r.approved_amount != null ? Number(r.approved_amount) : Number(r.total || 0);
}

// --- helpers de nome de arquivo ---
function competencia(requestDate) {
  if (!requestDate) return "0000.00";
  const [y, m] = requestDate.split("-");
  return `${y}.${m}`; // ano.mes vigente
}

function dataPagamentoToken(paymentDate) {
  if (!paymentDate) return "0000.00.00";
  const [y, m, d] = paymentDate.split("-");
  return `${y}.${m}.${d}`;
}

function nomeArquivoColaborador(name) {
  return (name || "Colaborador")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .replace(/[^a-zA-Z0-9 ]/g, "") // remove caracteres especiais
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(""); // "Lennon Santos" -> "LennonSantos"
}

function valorToken(total) {
  // sem separador de milhar (os pontos sao usados nas datas): R$2000,00
  return "R$" + Number(total || 0).toFixed(2).replace(".", ",");
}

export function buildReembolsoFileName(r) {
  const tipo = r.kind === "adiantamento" ? "ADIANTSN" : FIXO_TIPO;
  return [
    competencia(r.request_date),
    dataPagamentoToken(effectivePaymentDate(r)),
    FIXO_EMPRESA,
    nomeArquivoColaborador(r.requester_name),
    tipo,
    valorToken(paidAmount(r)),
  ].join("_") + ".pdf";
}

// --- geracao do PDF ---
export async function generateReembolsoPdf(r) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;

  const isAdiantamento = r.kind === "adiantamento";

  // Título + código alinhado à direita
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(38, 64, 93); // azul PHD
  doc.text(`Relatório de ${isAdiantamento ? "Adiantamento" : "Reembolso"}`, margin, 56);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(`${r.code ?? "—"}  •  REV ${String(r.rev ?? 1).padStart(3, "0")}`, pageW - margin, 56, {
    align: "right",
  });

  // Linha separadora
  doc.setDrawColor(224, 224, 224);
  doc.setLineWidth(0.8);
  doc.line(margin, 68, pageW - margin, 68);

  // Campos em duas colunas (rótulo cinza + valor em destaque)
  const half = (pageW - margin * 2) / 2;
  const col1 = margin;
  const col2 = margin + half;
  const lineH = 18;

  function field(label, value, x, yy) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(130, 130, 130);
    const lbl = `${label}: `;
    doc.text(lbl, x, yy);
    const w = doc.getTextWidth(lbl);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text(String(value ?? "—"), x + w, yy);
  }

  const dataLabel = isAdiantamento ? "Data do adiantamento" : "Data do reembolso";
  let y = 90;
  field("Colaborador", r.requester_name, col1, y);
  field("Status", STATUS_LABEL[r.status] ?? r.status, col2, y);
  y += lineH;
  field("Cliente / Obra", r.client_obra, col1, y);
  field("Gestor", r.manager_name ?? "—", col2, y);
  y += lineH;
  field("Chave PIX", r.pix_key, col1, y);
  field("Competência", competencia(r.request_date), col2, y);
  y += lineH;
  field(dataLabel, formatDate(r.request_date), col1, y);
  const payDate = effectivePaymentDate(r);
  field("Data de pagamento", payDate ? formatDate(payDate) : "—", col2, y);
  y += lineH;

  // Valor solicitado x aprovado (mostra o desconto quando houver)
  const paid = paidAmount(r);
  const total = Number(r.total || 0);
  field("Valor solicitado", formatCurrency(total), col1, y);
  field(
    "Valor aprovado",
    paid < total ? `${formatCurrency(paid)}  (desconto ${formatCurrency(total - paid)})` : formatCurrency(paid),
    col2,
    y
  );
  y += lineH;

  doc.setFont("helvetica", "normal");

  autoTable(doc, {
    startY: y + 8,
    head: [["QTD", "Item", "Data", "Valor", "Nº NF", "Local", "Observações"]],
    body: (r.items ?? []).map((it) => [
      String(it.qty ?? 1),
      it.description ?? "",
      formatDate(it.item_date),
      formatCurrency(it.value),
      it.nf_number ?? "—",
      it.local ?? "—",
      it.notes ?? "—",
    ]),
    foot: [["", "", "", formatCurrency(r.total), "", "", "TOTAL"]],
    styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [195, 94, 30] }, // terracotta
    footStyles: {
      fillColor: [242, 242, 242],
      textColor: [40, 40, 40],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 28, halign: "center" },
      3: { halign: "right" },
    },
    margin: { left: margin, right: margin },
  });

  // Uma pagina por imagem de NF anexada
  for (const img of r.nf_images ?? []) {
    let dataUrl;
    try {
      dataUrl = await refToDataUrl(img.ref);
    } catch {
      dataUrl = null;
    }
    if (!dataUrl) continue;

    doc.addPage();
    doc.setFontSize(11);
    doc.setTextColor(38, 64, 93);
    const legenda = [
      img.nf_number ? `NF ${img.nf_number}` : "NF s/ número",
      img.local || "",
      img.total != null ? formatCurrency(img.total) : "",
    ]
      .filter(Boolean)
      .join("  •  ");
    doc.text(legenda, margin, 40);

    try {
      const props = doc.getImageProperties(dataUrl);
      const maxW = pageW - margin * 2;
      const maxH = pageH - 70 - margin;
      const ratio = Math.min(maxW / props.width, maxH / props.height);
      const w = props.width * ratio;
      const h = props.height * ratio;
      doc.addImage(dataUrl, "JPEG", margin + (maxW - w) / 2, 55, w, h);
    } catch (err) {
      doc.setFontSize(9);
      doc.setTextColor(180, 60, 60);
      doc.text(`(não foi possível renderizar a imagem: ${err.message})`, margin, 70);
    }
  }

  doc.save(buildReembolsoFileName(r));
}
