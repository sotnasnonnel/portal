import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Ban, Check, FileDown, FileText, Loader2, Pencil, Trash2, X } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useConfirm, useToast } from "../context/FeedbackContext.jsx";
import {
  cancelReimbursement,
  decideAccountability,
  deleteReimbursement,
  getReimbursement,
  markSettlement,
  STATUS,
  updateReimbursementStatus,
} from "../services/reimbursements.js";
import { reconcileAdvance } from "../lib/advanceAccountability.js";
import { formatCurrency, formatDate } from "../lib/format.js";
import { evaluateFoodOverage } from "../lib/reimbursementPolicy.js";
import { kindMeta } from "../lib/kind.js";
import StatusBadge from "../components/StatusBadge.jsx";
import ImageLightbox from "../components/ImageLightbox.jsx";
import PolicyNotice from "../components/PolicyNotice.jsx";
import FoodOverageNotice from "../components/FoodOverageNotice.jsx";
import ForbiddenItemsNotice from "../components/ForbiddenItemsNotice.jsx";
import "./ReembolsoDetail.css";

export default function ReembolsoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const showToast = useToast();
  const confirm = useConfirm();
  const [reembolso, setReembolso] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [lightbox, setLightbox] = useState(null);
  const [accReturning, setAccReturning] = useState(false);
  const [accReturnNote, setAccReturnNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await getReimbursement(id);
    setReembolso(data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="page">
        <div className="page-loading" role="status" aria-live="polite">
          <Loader2 size={28} className="spin" aria-hidden="true" />
          <p>Carregando…</p>
        </div>
      </div>
    );
  }

  if (!reembolso) {
    return (
      <div className="page">
        <div className="page-loading">
          <FileText size={40} aria-hidden="true" />
          <p>Pedido não encontrado.</p>
          <button className="btn btn-ghost" onClick={() => navigate("/reembolsos")}>
            <ArrowLeft size={16} /> Voltar para a lista
          </button>
        </div>
      </div>
    );
  }

  // Apenas o gestor imediato atribuído decide, e nunca sobre o próprio pedido
  // (gestor também pode solicitar — não pode autoaprovar). Admin não aprova/reprova.
  const canDecide =
    profile?.role === "gestor" &&
    reembolso.status === STATUS.EM_ANALISE &&
    reembolso.manager_id === profile?.id &&
    reembolso.requester_id !== profile?.id;

  const canCancel =
    reembolso.status === STATUS.EM_ANALISE &&
    (profile?.role === "admin" || reembolso.requester_id === profile?.id);

  const canDelete = profile?.role === "admin";
  const isAdmin = profile?.role === "admin";
  const canIssuePdf = isAdmin && reembolso.status === STATUS.APROVADO;
  // Reprovado: o próprio solicitante pode ajustar e reenviar para aprovação.
  const canEdit =
    reembolso.status === STATUS.REPROVADO && reembolso.requester_id === profile?.id;
  const meta = kindMeta(reembolso.kind);

  // Excedente de alimentação -> permite aprovar com desconto.
  const total = Number(reembolso.total || 0);
  const foodCheck = evaluateFoodOverage(reembolso.items);
  const discountedTotal = Math.max(0, total - foodCheck.over);
  // Valor efetivamente aprovado/pago. Registros antigos (sem approved_amount)
  // foram aprovados pelo total cheio.
  const paidAmount = reembolso.approved_amount != null ? Number(reembolso.approved_amount) : total;
  const hadDiscount = reembolso.approved_amount != null && paidAmount < total;

  const isAdiantamento = reembolso.kind === "adiantamento";
  const accStatus = reembolso.accountability_status; // null|pendente|em_analise|acertado
  const isRequester = reembolso.requester_id === profile?.id;
  // separa itens do PEDIDO (false) das notas da PRESTAÇÃO (true)
  const requestItems = (reembolso.items ?? []).filter((it) => !it.is_accountability);
  const accItems = (reembolso.items ?? []).filter((it) => it.is_accountability);
  const accRec = reconcileAdvance({
    total: reembolso.total,
    accountabilityTotal: reembolso.accountability_total,
  });
  const canPrestarContas = isAdiantamento && isRequester && reembolso.status === STATUS.APROVADO && accStatus === "pendente";
  const canDecideAccountability =
    isAdiantamento && profile?.role === "gestor" && reembolso.manager_id === profile?.id && accStatus === "em_analise";
  const canMarkSettlement =
    isAdiantamento && accStatus === "acertado" && accRec.outcome !== "exato" && !reembolso.settlement &&
    (profile?.role === "admin" || (profile?.role === "gestor" && reembolso.manager_id === profile?.id));

  async function handleDecision(next, note, approvedAmount = null) {
    if (actionLoading) return;
    setActionLoading(true);
    const { error } = await updateReimbursementStatus(
      reembolso.id,
      next,
      profile,
      note,
      approvedAmount,
      reembolso.kind
    );
    setRejecting(false);
    setRejectNote("");
    await load();
    setActionLoading(false);
    if (error) {
      showToast(`Não foi possível concluir: ${error.message}`, "error");
      return;
    }
    const cap = `${meta.singular[0].toUpperCase()}${meta.singular.slice(1)}`;
    showToast(
      next === STATUS.APROVADO
        ? `${cap} aprovado — valor pago ${formatCurrency(approvedAmount ?? total)}.`
        : `${cap} reprovado.`,
      "success"
    );
  }

  // amount = valor a aprovar (total cheio ou já com desconto do excedente)
  async function handleApprove(amount) {
    if (actionLoading) return;
    const value = Number(amount);
    const withDiscount = value < total - 0.001;
    const ok = await confirm({
      title: withDiscount ? "Aprovar com desconto" : "Aprovar valor total",
      message:
        `Aprovar ${formatCurrency(value)} de ${reembolso.requester_name}?` +
        (withDiscount
          ? ` O excedente de alimentação (${formatCurrency(
              foodCheck.over
            )}) será descontado do valor solicitado (${formatCurrency(total)}).`
          : "") +
        " O solicitante verá o valor aprovado.",
      body: isAdiantamento ? undefined : (
        <>
          <ForbiddenItemsNotice items={reembolso.items} />
          <FoodOverageNotice items={reembolso.items} total={total} />
          <PolicyNotice compact />
        </>
      ),
      confirmLabel: withDiscount ? "Aprovar com desconto" : "Aprovar total",
    });
    if (!ok) return;
    await handleDecision(STATUS.APROVADO, null, value);
  }

  async function handleCancel() {
    if (actionLoading) return;
    const ok = await confirm({
      title: `Cancelar ${meta.singular}`,
      message: `Tem certeza que deseja cancelar este ${meta.singular}?`,
      confirmLabel: `Cancelar ${meta.singular}`,
      cancelLabel: "Voltar",
      tone: "danger",
    });
    if (!ok) return;
    setActionLoading(true);
    await cancelReimbursement(reembolso.id);
    await load();
    setActionLoading(false);
    showToast(
      `${meta.singular[0].toUpperCase()}${meta.singular.slice(1)} cancelado.`,
      "success"
    );
  }

  async function handleDelete() {
    if (actionLoading) return;
    const ok = await confirm({
      title: `Excluir ${meta.singular}`,
      message: `Esta ação é permanente e não pode ser desfeita. Excluir este ${meta.singular}?`,
      confirmLabel: "Excluir",
      cancelLabel: "Voltar",
      tone: "danger",
    });
    if (!ok) return;
    setActionLoading(true);
    await deleteReimbursement(reembolso.id);
    showToast(`${meta.singular[0].toUpperCase()}${meta.singular.slice(1)} excluído.`, "success");
    navigate(meta.base, { replace: true });
  }

  async function handleGeneratePdf() {
    if (generating) return;
    setGenerating(true);
    try {
      // import dinamico: jsPDF so e baixado quando o admin gera o PDF
      const { generateReembolsoPdf } = await import("../services/reembolsoPdf.js");
      await generateReembolsoPdf(reembolso);
    } catch (err) {
      showToast(`Falha ao gerar o PDF: ${err.message}`, "error");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDecideAccountability(decision, note) {
    if (actionLoading) return;
    if (decision === "aceitar") {
      const ok = await confirm({
        title: "Aceitar prestação de contas",
        message:
          accRec.outcome === "exato"
            ? "Comprovação bate com o adiantado. Fechar a prestação?"
            : accRec.outcome === "sobra"
              ? `Há sobra de ${formatCurrency(accRec.diff)} a devolver. Aceitar e fechar?`
              : `Houve falta de ${formatCurrency(Math.abs(accRec.diff))} (gasto a mais). Aceitar e fechar?`,
        confirmLabel: "Aceitar",
      });
      if (!ok) return;
    }
    setActionLoading(true);
    const { error } = await decideAccountability(reembolso.id, decision, {
      note,
      settlementWhenZero: decision === "aceitar" && accRec.outcome === "exato",
    });
    setAccReturning(false);
    setAccReturnNote("");
    await load();
    setActionLoading(false);
    if (error) {
      showToast(`Não foi possível concluir: ${error.message}`, "error");
      return;
    }
    showToast(decision === "aceitar" ? "Prestação aceita." : "Prestação devolvida para correção.", "success");
  }

  async function handleMarkSettlement(settlement) {
    if (actionLoading) return;
    setActionLoading(true);
    const { error } = await markSettlement(reembolso.id, settlement);
    await load();
    setActionLoading(false);
    if (error) {
      showToast(`Não foi possível registrar o acerto: ${error.message}`, "error");
      return;
    }
    showToast("Acerto registrado.", "success");
  }

  return (
    <div className="page">
      <header className="detail-header">
        <button type="button" className="btn btn-ghost" onClick={() => navigate(meta.base)}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="detail-title">
          <div>
            <h2>{reembolso.requester_name}</h2>
            <span className="rev">REV: {String(reembolso.rev ?? 1).padStart(3, "0")}</span>
          </div>
          <StatusBadge status={reembolso.status} />
          {meta.kind === "adiantamento" && <span className="kind-pill">Adiantamento</span>}
        </div>

        <div className="detail-actions">
          {canEdit && (
            <button
              className="btn btn-primary"
              onClick={() => navigate(`${meta.base}/${reembolso.id}/editar`)}
            >
              <Pencil size={16} /> Editar e reenviar
            </button>
          )}
          {canPrestarContas && (
            <button
              className="btn btn-primary"
              onClick={() => navigate(`/adiantamentos/${reembolso.id}/prestar-contas`)}
            >
              <FileText size={16} /> Prestar contas
            </button>
          )}
          {canDecide && (
            <>
              {foodCheck.hasOverage ? (
                <>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleApprove(discountedTotal)}
                    disabled={actionLoading}
                    title={`Desconta o excedente de alimentação (${formatCurrency(foodCheck.over)})`}
                  >
                    <Check size={16} /> Aprovar com desconto ({formatCurrency(discountedTotal)})
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => handleApprove(total)}
                    disabled={actionLoading}
                    title="Aprova o valor total, sem descontar o excedente"
                  >
                    Aprovar total ({formatCurrency(total)})
                  </button>
                </>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={() => handleApprove(total)}
                  disabled={actionLoading}
                >
                  <Check size={16} /> {actionLoading ? "Processando…" : "Aprovar"}
                </button>
              )}
              <button
                className="btn btn-ghost btn-danger"
                onClick={() => setRejecting((v) => !v)}
                disabled={actionLoading}
              >
                <X size={16} /> Reprovar
              </button>
            </>
          )}
          {canIssuePdf && (
            <button
              className="btn btn-primary"
              onClick={handleGeneratePdf}
              disabled={generating}
              title="Gerar PDF do reembolso (com NFs anexadas)"
            >
              <FileDown size={16} /> {generating ? "Gerando…" : "Gerar PDF"}
            </button>
          )}
          {canCancel && (
            <button className="btn btn-ghost" onClick={handleCancel} disabled={actionLoading}>
              <Ban size={16} /> Cancelar
            </button>
          )}
          {canDelete && (
            <button className="btn btn-ghost btn-danger" onClick={handleDelete} disabled={actionLoading}>
              <Trash2 size={16} /> Excluir
            </button>
          )}
        </div>
      </header>

      {reembolso.status === STATUS.REPROVADO && reembolso.decision_note && (
        <div className="reject-banner">
          <strong>Reprovado{reembolso.decided_by_name ? ` por ${reembolso.decided_by_name}` : ""}:</strong>{" "}
          {reembolso.decision_note}
        </div>
      )}

      {reembolso.status === STATUS.APROVADO && (
        <div className="approved-banner">
          <strong>
            Aprovado{reembolso.decided_by_name ? ` por ${reembolso.decided_by_name}` : ""}:
          </strong>{" "}
          Valor pago <strong>{formatCurrency(paidAmount)}</strong>
          {hadDiscount ? (
            <>
              {" "}— com desconto de <strong>{formatCurrency(total - paidAmount)}</strong> referente a
              alimentação acima do limite. Valor solicitado: {formatCurrency(total)}.
            </>
          ) : (
            " (valor integral solicitado)."
          )}
        </div>
      )}

      {canDecide && !isAdiantamento && <PolicyNotice />}

      {(canDecide || isAdmin) && (
        <>
          <FoodOverageNotice items={requestItems} total={reembolso.total} />
          <ForbiddenItemsNotice items={requestItems} />
        </>
      )}

      {rejecting && canDecide && (
        <section className="detail-card reject-card">
          <h3>Justificativa da reprovação</h3>
          <textarea
            rows={3}
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Explique o motivo da reprovação (será mostrado ao solicitante)."
          />
          <div className="reject-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setRejecting(false);
                setRejectNote("");
              }}
              disabled={actionLoading}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-danger"
              onClick={() => handleDecision(STATUS.REPROVADO, rejectNote)}
              disabled={actionLoading || !rejectNote.trim()}
            >
              <X size={16} /> {actionLoading ? "Reprovando…" : "Confirmar reprovação"}
            </button>
          </div>
        </section>
      )}

      <section className="detail-grid">
        <div className="detail-card">
          <h3>Cabeçalho</h3>
          <dl>
            <dt>Solicitante</dt>
            <dd>{reembolso.requester_name}</dd>
            <dt>Data</dt>
            <dd>{formatDate(reembolso.request_date)}</dd>
            <dt>Cliente / Obra</dt>
            <dd>{reembolso.client_obra}</dd>
            {reembolso.manager_name && (
              <>
                <dt>Gestor imediato</dt>
                <dd>{reembolso.manager_name}</dd>
              </>
            )}
            <dt>Chave PIX</dt>
            <dd>{reembolso.pix_key ?? "—"}</dd>
            <dt>{isAdiantamento ? "Data que precisa do valor" : "Data de pagamento"}</dt>
            <dd>{reembolso.payment_date ? formatDate(reembolso.payment_date) : "—"}</dd>
            <dt>Observações</dt>
            <dd>{reembolso.notes ?? "—"}</dd>
          </dl>
        </div>

        <div className="detail-card detail-total">
          <h3>{reembolso.status === STATUS.APROVADO ? "Valor pago" : `Total do ${meta.singular}`}</h3>
          <p className="total-amount">
            {formatCurrency(reembolso.status === STATUS.APROVADO ? paidAmount : total)}
          </p>
          {reembolso.status === STATUS.APROVADO && hadDiscount && (
            <span className="total-original">
              Solicitado {formatCurrency(total)} · desconto {formatCurrency(total - paidAmount)}
            </span>
          )}
          <span className="muted">{reembolso.items?.length ?? 0} item(ns)</span>
          {reembolso.decided_at && (
            <div className="decision-meta">
              <span>{reembolso.status === STATUS.APROVADO ? "Aprovado por" : "Reprovado por"}</span>
              <strong>{reembolso.decided_by_name ?? "—"}</strong>
              <small>{formatDate(reembolso.decided_at)}</small>
            </div>
          )}
        </div>
      </section>

      {isAdiantamento && accStatus && (
        <section className="detail-card acc-card">
          <h3>Prestação de contas</h3>
          <div className="acc-status-row">
            <span className={`acc-pill acc-${accStatus}`}>
              {accStatus === "pendente" && "Aguardando prestação"}
              {accStatus === "em_analise" && "Em análise do gestor"}
              {accStatus === "acertado" && "Acertado"}
            </span>
          </div>
          <dl className="acc-figures">
            <dt>Adiantado</dt><dd>{formatCurrency(accRec.adiantado)}</dd>
            <dt>Comprovado</dt><dd>{formatCurrency(accRec.comprovado)}</dd>
            <dt>{accRec.outcome === "falta" ? "Falta (a reembolsar)" : accRec.outcome === "sobra" ? "Sobra (a devolver)" : "Saldo"}</dt>
            <dd className={`acc-${accRec.outcome}`}>{formatCurrency(Math.abs(accRec.diff))}</dd>
            {reembolso.settlement && (
              <>
                <dt>Acerto</dt>
                <dd>
                  {reembolso.settlement === "devolvido" && "Devolvido"}
                  {reembolso.settlement === "complemento_pago" && "Complemento pago"}
                  {reembolso.settlement === "sem_acerto" && "Sem acerto necessário"}
                </dd>
              </>
            )}
          </dl>

          {reembolso.accountability_note && accStatus === "pendente" && (
            <div className="reject-banner">
              <strong>Devolvido para correção:</strong> {reembolso.accountability_note}
            </div>
          )}

          {accItems.length > 0 && (
            <div className="items-detail-scroll">
              <table className="items-detail-table">
                <thead>
                  <tr><th>QTD</th><th>Item</th><th>Data</th><th className="num">Valor</th><th>Nº NF</th><th>Local</th></tr>
                </thead>
                <tbody>
                  {accItems.map((it) => (
                    <tr key={it.id}>
                      <td data-label="QTD">{it.qty}</td>
                      <td data-label="Item">{it.description}</td>
                      <td data-label="Data">{formatDate(it.item_date)}</td>
                      <td className="num" data-label="Valor">{formatCurrency(it.value)}</td>
                      <td data-label="Nº NF">{it.nf_number ?? "—"}</td>
                      <td data-label="Local">{it.local ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canDecideAccountability && (
            <>
              <FoodOverageNotice items={accItems} total={accRec.comprovado} />
              <ForbiddenItemsNotice items={accItems} />
              <div className="acc-actions">
                <button className="btn btn-primary" disabled={actionLoading} onClick={() => handleDecideAccountability("aceitar")}>
                  <Check size={16} /> Aceitar prestação
                </button>
                <button className="btn btn-ghost btn-danger" disabled={actionLoading} onClick={() => setAccReturning((v) => !v)}>
                  <X size={16} /> Devolver para correção
                </button>
              </div>
              {accReturning && (
                <div className="reject-card">
                  <textarea rows={3} value={accReturnNote} onChange={(e) => setAccReturnNote(e.target.value)}
                    placeholder="Explique o que precisa ser corrigido (será mostrado ao solicitante)." />
                  <div className="reject-actions">
                    <button className="btn btn-ghost" disabled={actionLoading} onClick={() => { setAccReturning(false); setAccReturnNote(""); }}>Cancelar</button>
                    <button className="btn btn-ghost btn-danger" disabled={actionLoading || !accReturnNote.trim()}
                      onClick={() => handleDecideAccountability("devolver", accReturnNote)}>
                      <X size={16} /> Confirmar devolução
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {canMarkSettlement && (
            <div className="acc-actions">
              {accRec.outcome === "sobra" && (
                <button className="btn btn-primary" disabled={actionLoading} onClick={() => handleMarkSettlement("devolvido")}>
                  Marcar sobra como devolvida
                </button>
              )}
              {accRec.outcome === "falta" && (
                <button className="btn btn-primary" disabled={actionLoading} onClick={() => handleMarkSettlement("complemento_pago")}>
                  Marcar complemento como pago
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {canIssuePdf && (
        <section className="detail-card payment-card">
          <h3>Pagamento</h3>
          <p className="payment-date-value">
            {isAdiantamento ? "Data que precisa do valor:" : "Data de pagamento:"}{" "}
            <strong>{reembolso.payment_date ? formatDate(reembolso.payment_date) : "—"}</strong>
          </p>
          <p className="payment-hint">
            {isAdiantamento
              ? "Informada pelo solicitante ao pedir o adiantamento. Compõe o nome do arquivo do PDF."
              : "Calculada automaticamente pela data de aprovação (aprovado até dia 20 → pagamento no dia 1º; aprovado entre os dias 21 e 5 → pagamento no dia 15). Compõe o nome do arquivo do PDF."}
          </p>
        </section>
      )}

      {reembolso.nf_images?.length > 0 && (
        <section className="detail-card">
          <h3>Notas anexadas ({reembolso.nf_images.length})</h3>
          <div className="nf-detail-thumbs">
            {reembolso.nf_images.map((img) => {
              const label = img.nf_number ? `NF ${img.nf_number}` : "NF";
              return (
                <div className="nf-detail-thumb" key={img.id}>
                  {img.ref?.value && (
                    <button
                      type="button"
                      className="nf-thumb-btn"
                      onClick={() => setLightbox({ src: img.ref.value, alt: label })}
                      title="Clique para abrir"
                    >
                      <img src={img.ref.value} alt={label} />
                    </button>
                  )}
                  <span>{label}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="detail-card">
        <h3>Itens</h3>
        <div className="items-detail-scroll">
          <table className="items-detail-table">
            <thead>
              <tr>
                <th>QTD</th>
                <th>Item</th>
                {!isAdiantamento && <th>Data</th>}
                <th className="num">Valor</th>
                {!isAdiantamento && <th>Nº NF</th>}
                {!isAdiantamento && <th>Local</th>}
                <th>Observações</th>
              </tr>
            </thead>
            <tbody>
              {requestItems.map((item) => (
                <tr key={item.id}>
                  <td data-label="QTD">{item.qty}</td>
                  <td data-label="Item">{item.description}</td>
                  {!isAdiantamento && <td data-label="Data">{formatDate(item.item_date)}</td>}
                  <td className="num" data-label="Valor">{formatCurrency(item.value)}</td>
                  {!isAdiantamento && <td data-label="Nº NF">{item.nf_number ?? "—"}</td>}
                  {!isAdiantamento && <td data-label="Local">{item.local ?? "—"}</td>}
                  <td data-label="Observações">{item.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={isAdiantamento ? 2 : 3} />
                <td className="num"><strong>{formatCurrency(reembolso.total)}</strong></td>
                <td colSpan={isAdiantamento ? 1 : 3} />
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="items-detail-total" aria-hidden="true">
          <span>Total</span>
          <strong>{formatCurrency(reembolso.total)}</strong>
        </div>
      </section>

      {lightbox && (
        <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}
