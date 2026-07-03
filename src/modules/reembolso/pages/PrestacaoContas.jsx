import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Camera, Loader2, Plus, Send, Trash2, Upload, X } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/FeedbackContext.jsx";
import {
  getReimbursement,
  saveAccountability,
  submitAccountability,
  notifyApprover,
  STATUS,
} from "../services/reimbursements.js";
import { extractNfFromDataUrl } from "../services/nfExtraction.js";
import { compressImageToDataUrl } from "../lib/image.js";
import { formatCurrency } from "../lib/format.js";
import { makeKey, newItem, itemsFromExtraction } from "../lib/nfCapture.js";
import { reconcileAdvance } from "../lib/advanceAccountability.js";
import { detectForbiddenItems } from "../lib/reimbursementPolicy.js";
import CameraCapture from "../components/CameraCapture.jsx";
import ImageLightbox from "../components/ImageLightbox.jsx";
import FoodOverageNotice from "../components/FoodOverageNotice.jsx";
import ForbiddenItemsNotice from "../components/ForbiddenItemsNotice.jsx";
import "./ReembolsoForm.css";
import "./PrestacaoContas.css";

// Mapeiam o registro do banco -> estado do formulário (notas da prestação).
// Reutilizados no carregamento e após salvar (re-hidrata mantendo a tela).
function mapAccItems(data) {
  const accItems = (data.items ?? []).filter((it) => it.is_accountability);
  return accItems.length > 0
    ? accItems.map((it, idx) => ({
        _key: makeKey(),
        qty: it.qty ?? 1,
        description: it.description ?? "",
        item_date: it.item_date ?? "",
        value: it.value != null ? String(it.value) : "",
        nf_number: it.nf_number ?? "",
        local: it.local ?? "",
        notes: it.notes ?? "",
        meal_category: it.meal_category ?? "",
        nf_ref: null,
        nf_image_id: it.nf_image_id ?? null,
        sort_order: idx,
      }))
    : [newItem(0)];
}

function mapAccNfImages(data) {
  return (data.nf_images ?? [])
    .filter((img) => img.is_accountability)
    .map((img) => ({
      id: img.id,
      existing: true,
      url: img.ref?.value ?? null,
      nf_number: img.nf_number ?? "",
      local: img.local ?? "",
      data_nf: img.data_nf ?? "",
      total: img.total ?? null,
    }));
}

export default function PrestacaoContas() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const showToast = useToast();

  const [loading, setLoading] = useState(true);
  const [advance, setAdvance] = useState(null);
  const [items, setItems] = useState([]);
  const [nfImages, setNfImages] = useState([]);
  const [removedNfImageIds, setRemovedNfImageIds] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [saving, setSaving] = useState(false);
  // edições locais ainda não salvas (controla se precisa re-salvar ao enviar)
  const [dirty, setDirty] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const comprovado = useMemo(
    () => items.reduce((s, it) => s + Number(it.qty || 1) * Number(it.value || 0), 0),
    [items]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await getReimbursement(id);
      if (!active) return;
      const ok =
        data &&
        data.kind === "adiantamento" &&
        data.requester_id === profile?.id &&
        data.status === STATUS.APROVADO &&
        data.accountability_status === "pendente";
      if (!ok) {
        showToast("Esta prestação de contas não está disponível.", "warning");
        navigate(`/adiantamentos/${id}`, { replace: true });
        return;
      }
      setAdvance(data);
      setItems(mapAccItems(data));
      setNfImages(mapAccNfImages(data));
      setDirty(false);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id, profile?.id, navigate, showToast]);

  function patchItem(key, patch) {
    setDirty(true);
    setItems((prev) => prev.map((it) => (it._key === key ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setDirty(true);
    setItems((prev) => [...prev, newItem(prev.length)]);
  }
  function removeItem(key) {
    setDirty(true);
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((it) => it._key !== key)));
  }
  function removeNfImage(imgId) {
    setDirty(true);
    const img = nfImages.find((x) => x.id === imgId);
    if (img?.existing) setRemovedNfImageIds((r) => (r.includes(imgId) ? r : [...r, imgId]));
    setNfImages((prev) => prev.filter((x) => x.id !== imgId));
    setItems((prev) => {
      const filtered = prev.filter((it) => it.nf_ref !== imgId && it.nf_image_id !== imgId);
      const next = filtered.length > 0 ? filtered : [newItem(0)];
      return next.map((it, idx) => ({ ...it, sort_order: idx }));
    });
  }

  async function processFiles(files) {
    if (files.length === 0) return;
    setImportError("");
    setImporting(true);
    const results = [];
    const failures = [];
    for (const file of files) {
      try {
        const dataUrl = await compressImageToDataUrl(file);
        const data = await extractNfFromDataUrl(dataUrl);
        results.push({ data, dataUrl });
      } catch (err) {
        failures.push(`${file.name || "foto"}: ${err.message}`);
      }
    }
    setImporting(false);

    if (results.length > 0) {
      const newImages = [];
      const newItems = [];
      results.forEach(({ data, dataUrl }) => {
        const nfId = makeKey();
        newImages.push({
          id: nfId,
          dataUrl,
          nf_number: data?.numero_nota ? String(data.numero_nota) : "",
          local: data?.local ? String(data.local) : "",
          data_nf: data?.data_nf || "",
          total: data?.valor_total != null ? Number(data.valor_total) : null,
        });
        itemsFromExtraction(data, 0).forEach((it) => newItems.push({ ...it, nf_ref: nfId }));
      });
      setDirty(true);
      setNfImages((prev) => [...prev, ...newImages]);
      setItems((prev) => {
        const base = prev.length === 1 && !prev[0].description && !prev[0].value ? [] : prev;
        return [...base, ...newItems].map((it, idx) => ({ ...it, sort_order: idx }));
      });
      const forbidden = detectForbiddenItems(newItems);
      if (forbidden.hasForbidden) {
        const nomes = forbidden.items.map((x) => x.description).join(", ");
        showToast(`Item(ns) não permitido(s): ${nomes}.`, "error", 8000);
      }
    }
    if (failures.length > 0) setImportError(`Não consegui ler: ${failures.join(" | ")}`);
  }

  function handleImportFiles(event) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    processFiles(files);
  }
  function openCamera() {
    if (window.isSecureContext && navigator.mediaDevices?.getUserMedia) setShowCamera(true);
    else cameraInputRef.current?.click();
  }
  function handleCameraCapture(file) {
    setShowCamera(false);
    processFiles([file]);
  }

  function mappedItems() {
    return items
      .filter((it) => it.description && Number(it.value) > 0)
      .map((it, idx) => ({
        qty: Number(it.qty || 1),
        description: it.description.trim(),
        item_date: it.item_date,
        value: Number(it.value || 0),
        nf_number: it.nf_number?.trim() || null,
        local: it.local?.trim() || null,
        notes: it.notes?.trim() || null,
        meal_category: it.meal_category?.trim() || null,
        nf_ref: it.nf_ref ?? null,
        nf_image_id: it.nf_image_id ?? null,
        sort_order: idx,
      }));
  }

  async function persist() {
    return saveAccountability(id, {
      items: mappedItems(),
      nfImages,
      removedNfImageIds,
    });
  }

  // Salva as notas e CONTINUA na tela, para anexar mais se precisar.
  // Re-hidrata o estado com o que foi salvo (as fotos viram URLs salvas,
  // evitando reenviá-las no próximo salvamento).
  async function handleSaveDraft() {
    if (saving) return;
    setSaving(true);
    try {
      const { data, error } = await persist();
      if (error) {
        showToast(`Não foi possível salvar: ${error.message}`, "error");
        return;
      }
      if (data) {
        setAdvance(data);
        setItems(mapAccItems(data));
        setNfImages(mapAccNfImages(data));
        setRemovedNfImageIds([]);
        setDirty(false);
      }
      showToast("Notas salvas. Você pode anexar mais antes de enviar.", "success");
    } catch (err) {
      showToast(`Não foi possível salvar: ${err.message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (saving) return;
    if (mappedItems().length === 0) {
      showToast("Anexe ao menos uma nota com descrição e valor.", "warning");
      return;
    }
    // só envia quando o comprovado alcança (ou passa) o valor adiantado
    const adiantado = Number(advance.total || 0);
    if (comprovado < adiantado - 0.001) {
      showToast(
        `Ainda faltam ${formatCurrency(adiantado - comprovado)} para comprovar todo o adiantamento.`,
        "warning"
      );
      return;
    }
    setSaving(true);
    try {
      // só re-salva se houver edições locais pendentes; reabertura sem mexer
      // vai direto pro envio (um único UPDATE, sem reprocessar as notas).
      if (dirty) {
        const { error: saveErr } = await persist();
        if (saveErr) {
          showToast(`Não foi possível salvar: ${saveErr.message}`, "error");
          return;
        }
        setDirty(false);
      }
      const { error: subErr } = await submitAccountability(id);
      if (subErr) {
        showToast(`Não foi possível enviar: ${subErr.message}`, "error");
        return;
      }
      notifyApprover(id);
      showToast("Prestação de contas enviada para o gestor.", "success");
      navigate(`/adiantamentos/${id}`);
    } catch (err) {
      showToast(`Não foi possível enviar: ${err.message}`, "error");
    } finally {
      setSaving(false);
    }
  }

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

  const rec = reconcileAdvance({ total: advance.total, accountabilityTotal: comprovado });
  // só libera o envio quando o comprovado alcança (ou passa) o adiantado
  const podeEnviar = rec.comprovado >= rec.adiantado - 0.001;
  const faltaComprovar = Math.max(0, rec.adiantado - rec.comprovado);

  return (
    <div className="page">
      <header className="form-header">
        <button type="button" className="btn btn-ghost" onClick={() => navigate(`/adiantamentos/${id}`)}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <div>
          <h2>Prestação de contas</h2>
          <p className="page-sub">Anexe as notas comprovando o gasto do adiantamento.</p>
        </div>
      </header>

      <section className="acc-summary">
        <div><span>Adiantado</span><strong>{formatCurrency(rec.adiantado)}</strong></div>
        <div><span>Comprovado</span><strong>{formatCurrency(rec.comprovado)}</strong></div>
        <div className={`acc-diff acc-${rec.outcome}`}>
          <span>{rec.outcome === "falta" ? "Falta (a reembolsar)" : rec.outcome === "sobra" ? "Sobra (a devolver)" : "Acerto"}</span>
          <strong>{formatCurrency(Math.abs(rec.diff))}</strong>
        </div>
      </section>

      <section className="form-card">
        <div className="items-head">
          <h3>Notas do gasto</h3>
          <div className="items-actions">
            <button type="button" className="btn btn-ghost" onClick={openCamera} disabled={importing}>
              <Camera size={16} /> Tirar foto
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => fileInputRef.current?.click()} disabled={importing}>
              <Upload size={16} /> Importar NF
            </button>
            <button type="button" className="btn btn-ghost" onClick={addItem}>
              <Plus size={16} /> Adicionar item
            </button>
            {importing && <span className="nf-importing"><Loader2 size={14} className="spin" /> Lendo nota…</span>}
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden onChange={handleImportFiles} />
            <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={handleImportFiles} />
          </div>
        </div>

        {importError && <div className="nf-import-error">{importError}</div>}

        {nfImages.length > 0 && (
          <div className="nf-attachments">
            <span className="nf-attachments-label">{nfImages.length} nota(s) anexada(s)</span>
            <div className="nf-thumbs">
              {nfImages.map((img) => (
                <div className="nf-thumb" key={img.id}>
                  <img
                    src={img.dataUrl ?? img.url}
                    alt={img.nf_number ? `NF ${img.nf_number}` : "NF"}
                    role="button"
                    tabIndex={0}
                    onClick={() => setLightbox({ src: img.dataUrl ?? img.url, alt: img.nf_number ? `NF ${img.nf_number}` : "NF" })}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setLightbox({ src: img.dataUrl ?? img.url, alt: "NF" }); } }}
                  />
                  <button type="button" className="nf-thumb-remove" onClick={() => removeNfImage(img.id)} aria-label="Remover nota">
                    <X size={12} />
                  </button>
                  <span className="nf-thumb-label">{img.nf_number ? `NF ${img.nf_number}` : "NF"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="items-table">
          <div className="items-row items-row-head" aria-hidden="true">
            <span>QTD</span><span>Item</span><span>Data</span><span>Valor (R$)</span><span>Nº NF</span><span>Local</span><span>Observações</span><span />
          </div>
          {items.map((it, idx) => (
            <div className="items-row" key={it._key}>
              <span className="items-row-num" aria-hidden="true">{idx + 1}</span>
              <label className="item-cell" data-field="QTD"><span className="item-cell-label">QTD</span>
                <input type="number" min="1" step="1" value={it.qty} onChange={(e) => patchItem(it._key, { qty: e.target.value })} /></label>
              <label className="item-cell" data-field="Item"><span className="item-cell-label">Item</span>
                <input value={it.description} onChange={(e) => patchItem(it._key, { description: e.target.value.toUpperCase() })} placeholder="ALMOÇO, HOSPEDAGEM…" /></label>
              <label className="item-cell" data-field="Data"><span className="item-cell-label">Data</span>
                <input type="date" value={it.item_date} onChange={(e) => patchItem(it._key, { item_date: e.target.value })} /></label>
              <label className="item-cell" data-field="Valor"><span className="item-cell-label">Valor (R$)</span>
                <input type="number" min="0" step="0.01" value={it.value} onChange={(e) => patchItem(it._key, { value: e.target.value })} placeholder="0,00" /></label>
              <label className="item-cell" data-field="NF"><span className="item-cell-label">Nº NF</span>
                <input value={it.nf_number} onChange={(e) => patchItem(it._key, { nf_number: e.target.value })} placeholder="Nº NF" /></label>
              <label className="item-cell" data-field="Local"><span className="item-cell-label">Local</span>
                <input value={it.local} onChange={(e) => patchItem(it._key, { local: e.target.value })} placeholder="Estabelecimento" /></label>
              <label className="item-cell" data-field="Observações"><span className="item-cell-label">Observações</span>
                <input value={it.notes} onChange={(e) => patchItem(it._key, { notes: e.target.value })} placeholder="Observação" /></label>
              <button type="button" className="icon-btn" onClick={() => removeItem(it._key)} disabled={items.length === 1} aria-label={`Remover item ${idx + 1}`}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        <div className="items-total"><span>Total comprovado</span><strong>{formatCurrency(comprovado)}</strong></div>
        <FoodOverageNotice items={items} total={comprovado} />
        <ForbiddenItemsNotice items={items} />
      </section>

      <div className="acc-actions-bar">
        {!podeEnviar && (
          <p className="acc-submit-hint">
            Faltam <strong>{formatCurrency(faltaComprovar)}</strong> em notas para comprovar todo o
            adiantamento. Anexe mais notas para liberar o envio.
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={handleSaveDraft} disabled={saving}>
            {saving ? "Salvando…" : "Salvar notas"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={saving || !podeEnviar}
            title={podeEnviar ? "Enviar a prestação para o gestor" : "Comprove todo o adiantamento para enviar"}
          >
            <Send size={16} /> {saving ? "Enviando…" : "Enviar prestação"}
          </button>
        </div>
      </div>

      {showCamera && <CameraCapture onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />}
      {lightbox && <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
    </div>
  );
}
