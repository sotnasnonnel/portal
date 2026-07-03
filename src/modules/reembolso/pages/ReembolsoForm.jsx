import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Camera, Loader2, Paperclip, Plus, Save, Send, Trash2, Upload, X } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/FeedbackContext.jsx";
import {
  createReimbursement,
  getReimbursement,
  listGestores,
  notifyApprover,
  STATUS,
  updateReimbursement,
} from "../services/reimbursements.js";
import { extractNfFromDataUrl } from "../services/nfExtraction.js";
import { compressImageToDataUrl } from "../lib/image.js";
import { formatCurrency, todayIso } from "../lib/format.js";
import { makeKey, newItem, itemsFromExtraction } from "../lib/nfCapture.js";
import { evaluateFoodOverage, detectForbiddenItems } from "../lib/reimbursementPolicy.js";
import { kindMeta } from "../lib/kind.js";
import CameraCapture from "../components/CameraCapture.jsx";
import ImageLightbox from "../components/ImageLightbox.jsx";
import PolicyNotice from "../components/PolicyNotice.jsx";
import FoodOverageNotice from "../components/FoodOverageNotice.jsx";
import ForbiddenItemsNotice from "../components/ForbiddenItemsNotice.jsx";
import "./ReembolsoForm.css";

const ITEM_SUGGESTIONS = [
  "JANTA",
  "ALMOÇO",
  "UBER",
  "ESTACIONAMENTO",
  "COMBUSTÍVEL",
  "PEDÁGIO",
  "HOSPEDAGEM",
  "ADIANTAMENTO",
];

export default function ReembolsoForm({ kind = "reembolso" }) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const showToast = useToast();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const meta = kindMeta(kind);
  const allowNf = meta.allowNf; // adiantamento não tem foto/NF
  const isAdiantamento = meta.kind === "adiantamento";
  // Gestor que cria o próprio pedido: não escolhe aprovador e já entra aprovado.
  const isGestor = profile?.role === "gestor";
  const selfApprove = isGestor && !isEdit;

  const [requestDate, setRequestDate] = useState(todayIso());
  // adiantamento: data em que o solicitante precisa do valor (vira a data de pagamento)
  const [neededDate, setNeededDate] = useState("");
  const [clientObra, setClientObra] = useState("");
  const [pixKey, setPixKey] = useState(profile?.pix_key ?? "");
  const [gestores, setGestores] = useState([]);
  const [managerId, setManagerId] = useState(profile?.manager_id ?? "");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([newItem(0)]);
  const [nfImages, setNfImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // edição (reenvio de um reembolso reprovado)
  const [loadingExisting, setLoadingExisting] = useState(isEdit);
  const [currentRev, setCurrentRev] = useState(1);
  const [rejectionNote, setRejectionNote] = useState("");
  const [removedNfImageIds, setRemovedNfImageIds] = useState([]);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const total = useMemo(
    () => items.reduce((sum, it) => sum + Number(it.qty || 1) * Number(it.value || 0), 0),
    [items]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await listGestores();
      if (active) setGestores(data);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Modo edição: carrega o reembolso e pré-preenche. Só o dono pode editar, e
  // só quando reprovado (é o caso de "ajustar e reenviar").
  useEffect(() => {
    if (!isEdit || !profile?.id) return undefined;
    const m = kindMeta(kind);
    const cap = `${m.singular[0].toUpperCase()}${m.singular.slice(1)}`;
    let active = true;
    (async () => {
      const { data } = await getReimbursement(id);
      if (!active) return;
      if (!data) {
        showToast(`${cap} não encontrado.`, "error");
        navigate(m.base, { replace: true });
        return;
      }
      if (data.requester_id !== profile.id || data.status !== STATUS.REPROVADO) {
        showToast(`Este ${m.singular} não está disponível para edição.`, "warning");
        navigate(`${m.base}/${id}`, { replace: true });
        return;
      }
      setRequestDate(data.request_date ?? todayIso());
      setNeededDate(data.payment_date ?? "");
      setClientObra(data.client_obra ?? "");
      setPixKey(data.pix_key ?? "");
      setManagerId(data.manager_id ?? "");
      setNotes(data.notes ?? "");
      setCurrentRev(data.rev ?? 1);
      setRejectionNote(data.decision_note ?? "");
      setItems(
        (data.items ?? []).length > 0
          ? data.items.map((it, idx) => ({
              _key: makeKey(),
              qty: it.qty ?? 1,
              description: it.description ?? "",
              item_date: it.item_date ?? todayIso(),
              value: it.value != null ? String(it.value) : "",
              nf_number: it.nf_number ?? "",
              local: it.local ?? "",
              notes: it.notes ?? "",
              meal_category: it.meal_category ?? "",
              nf_ref: null,
              nf_image_id: it.nf_image_id ?? null,
              sort_order: idx,
            }))
          : [newItem(0)]
      );
      setNfImages(
        (data.nf_images ?? []).map((img) => ({
          id: img.id,
          existing: true,
          url: img.ref?.value ?? null,
          nf_number: img.nf_number ?? "",
          local: img.local ?? "",
          data_nf: img.data_nf ?? "",
          total: img.total ?? null,
        }))
      );
      setLoadingExisting(false);
    })();
    return () => {
      active = false;
    };
  }, [id, isEdit, kind, profile?.id, navigate, showToast]);

  function patchItem(key, patch) {
    setItems((prev) => prev.map((it) => (it._key === key ? { ...it, ...patch } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, newItem(prev.length)]);
  }

  function removeItem(key) {
    setItems((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((it) => it._key !== key);
    });
  }

  // Remove uma nota anexada e os itens que vieram dela.
  function removeNfImage(imgId) {
    const img = nfImages.find((x) => x.id === imgId);
    // se já existia no banco, marca para exclusão no salvamento
    if (img?.existing) {
      setRemovedNfImageIds((r) => (r.includes(imgId) ? r : [...r, imgId]));
    }
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
    const results = []; // { data, dataUrl }
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
        itemsFromExtraction(data, 0).forEach((it) =>
          newItems.push({ ...it, nf_ref: nfId })
        );
      });

      setNfImages((prev) => [...prev, ...newImages]);
      setItems((prev) => {
        // descarta a linha inicial vazia, se for a unica
        const base =
          prev.length === 1 && !prev[0].description && !prev[0].value ? [] : prev;
        return [...base, ...newItems].map((it, idx) => ({ ...it, sort_order: idx }));
      });

      // Alerta imediato: se a IA leu uma refeição acima do limite, avisa quanto
      // passou já no momento da importação da nota.
      const food = evaluateFoodOverage(newItems);
      if (food.hasOverage) {
        showToast(
          `Alimentação acima do limite nesta nota: ${formatCurrency(food.spent)} gastos, ` +
            `${formatCurrency(food.allowed)} dentro do limite — excede ${formatCurrency(food.over)}.`,
          "warning",
          7000
        );
      }

      // Alerta de itens proibidos detectados na nota (bebida alcoólica, etc.).
      const forbidden = detectForbiddenItems(newItems);
      if (forbidden.hasForbidden) {
        const nomes = forbidden.items.map((x) => x.description).join(", ");
        showToast(`Item(ns) não permitido(s) nesta nota: ${nomes}. Não podem ser reembolsados.`, "error", 8000);
      }
    }
    if (failures.length > 0) {
      setImportError(`Não consegui ler: ${failures.join(" | ")}`);
    }
  }

  function handleImportFiles(event) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = ""; // permite reescolher o mesmo arquivo depois
    processFiles(files);
  }

  function openCamera() {
    // Camera ao vivo (getUserMedia) exige contexto seguro: localhost ou HTTPS.
    if (window.isSecureContext && navigator.mediaDevices?.getUserMedia) {
      setShowCamera(true);
    } else {
      // Fallback: app de camera nativo do celular (ou seletor de arquivo).
      cameraInputRef.current?.click();
    }
  }

  function handleCameraCapture(file) {
    setShowCamera(false);
    processFiles([file]);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setError("");

    if (!clientObra.trim()) {
      setError("Informe o Cliente/Obra.");
      return;
    }
    if (isAdiantamento && !neededDate) {
      setError("Informe a data em que você precisa do valor.");
      return;
    }
    if (!selfApprove) {
      if (!managerId) {
        setError("Selecione o gestor imediato.");
        return;
      }
      if (managerId === profile?.id) {
        setError("Você não pode selecionar a si mesmo como gestor aprovador.");
        return;
      }
    }
    const validItems = items.filter((it) => it.description && Number(it.value) > 0);
    if (validItems.length === 0) {
      setError("Adicione pelo menos um item com descrição e valor.");
      return;
    }

    const manager = gestores.find((g) => g.id === managerId);

    const mappedItems = validItems.map((it, idx) => ({
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

    setSubmitting(true);

    if (isEdit) {
      const { error: submitError } = await updateReimbursement(id, {
        header: {
          request_date: requestDate,
          client_obra: clientObra.trim(),
          manager_id: managerId,
          manager_name: manager?.display_name || manager?.full_name || null,
          pix_key: pixKey.trim() || null,
          notes: notes.trim() || null,
          rev: (currentRev ?? 1) + 1,
          // adiantamento: mantém/atualiza a data que o solicitante precisa do valor
          ...(isAdiantamento ? { payment_date: neededDate || null } : {}),
        },
        items: mappedItems,
        nfImages,
        removedNfImageIds,
      });
      setSubmitting(false);
      if (submitError) {
        setError(submitError.message || "Não foi possível reenviar.");
        return;
      }
      // reenvio volta para em_analise -> avisa o gestor imediato
      if (managerId) notifyApprover(id);
      showToast(`${meta.singular[0].toUpperCase()}${meta.singular.slice(1)} reenviado para aprovação.`, "success");
      navigate(`${meta.base}/${id}`, { replace: true });
      return;
    }

    const { data, error: submitError } = await createReimbursement({
      header: {
        requester_id: profile?.id ?? "anon",
        requester_name: profile?.display_name || profile?.full_name || "Convidado",
        request_date: requestDate,
        client_obra: clientObra.trim(),
        manager_id: selfApprove ? null : managerId,
        manager_name: selfApprove ? null : manager?.display_name || manager?.full_name || null,
        pix_key: pixKey.trim() || null,
        notes: notes.trim() || null,
        kind: meta.kind,
        // adiantamento: a data informada pelo solicitante é a data de pagamento
        ...(isAdiantamento && neededDate ? { payment_date: neededDate } : {}),
        // gestor: aprovado automaticamente, sem passar por aprovação
        ...(selfApprove
          ? {
              status: STATUS.APROVADO,
              decided_by_id: profile?.id ?? null,
              decided_by_name: profile?.display_name || profile?.full_name || null,
              decided_at: new Date().toISOString(),
            }
          : {}),
      },
      items: mappedItems,
      nfImages,
    });
    setSubmitting(false);

    if (submitError) {
      setError(submitError.message || "Não foi possível salvar.");
      return;
    }

    // pedido de solicitante entra em análise -> avisa o gestor imediato.
    // (gestor que cria o próprio já entra aprovado, sem gestor -> não notifica)
    if (!selfApprove && managerId) notifyApprover(data.id);

    if (selfApprove)
      showToast(
        `${meta.singular[0].toUpperCase()}${meta.singular.slice(1)} criado e aprovado automaticamente.`,
        "success"
      );
    navigate(`${meta.base}/${data.id}`, { replace: true });
  }

  if (loadingExisting) {
    return (
      <div className="page">
        <div className="page-loading" role="status" aria-live="polite">
          <Loader2 size={28} className="spin" aria-hidden="true" />
          <p>Carregando {meta.singular}…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="form-header">
        <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <div>
          <h2>{isEdit ? "Editar e reenviar" : meta.novo}</h2>
          <p className="page-sub">
            {isEdit
              ? "Ajuste o que for necessário e reenvie para aprovação."
              : `Preencha o cabeçalho e adicione os itens do ${meta.singular}.`}
          </p>
        </div>
      </header>

      {isEdit && rejectionNote && (
        <div className="form-reject-note">
          <strong>Motivo da reprovação:</strong> {rejectionNote}
        </div>
      )}

      <form className="reembolso-form" onSubmit={handleSubmit}>
        {/* regras de despesa (alimentação/proibidos) só valem ao gastar:
            no reembolso. No adiantamento elas aparecem na prestação de contas. */}
        {!isAdiantamento && <PolicyNotice />}

        <section className="form-card">
          <h3>Cabeçalho</h3>
          <div className="grid-2">
            <label className="field">
              <span>Nome</span>
              <input value={profile?.display_name || profile?.full_name || ""} disabled />
            </label>
            <label className="field">
              <span>Data</span>
              <input
                type="date"
                value={requestDate}
                onChange={(e) => setRequestDate(e.target.value)}
                required
              />
            </label>
            {isAdiantamento && (
              <label className="field">
                <span>Data que preciso do valor</span>
                <input
                  type="date"
                  value={neededDate}
                  onChange={(e) => setNeededDate(e.target.value)}
                  required
                />
              </label>
            )}
            <label className="field">
              <span>Cliente / Obra</span>
              <input
                value={clientObra}
                onChange={(e) => setClientObra(e.target.value)}
                placeholder="Ex.: APER-CT01-CONS"
                required
              />
            </label>
            {selfApprove ? (
              <label className="field">
                <span>Aprovação</span>
                <p className="field-note">
                  Como gestor, seu {meta.singular} é <strong>aprovado automaticamente</strong> — sem
                  gestor imediato.
                </p>
              </label>
            ) : (
              <label className="field">
                <span>Gestor imediato</span>
                <select
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                  required
                >
                  <option value="">Selecione o gestor…</option>
                  {gestores
                    .filter((g) => g.id !== profile?.id)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.display_name || g.full_name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label className="field">
              <span>Chave PIX</span>
              <input
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="Telefone, CPF, e-mail ou chave aleatória"
              />
            </label>
            <label className="field field-full">
              <span>Observações gerais (opcional)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contexto da viagem, justificativa, etc."
                rows={2}
              />
            </label>
          </div>
        </section>

        <section className="form-card">
          <div className="items-head">
            <h3>Itens do {meta.singular}</h3>
            <div className="items-actions">
              {allowNf && (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={openCamera}
                    disabled={importing}
                    title="Tirar foto da nota fiscal (a IA preenche os itens)"
                  >
                    <Camera size={16} /> Tirar foto
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing}
                    title="Escolher imagem da nota fiscal (a IA preenche os itens)"
                  >
                    <Upload size={16} /> Importar NF
                  </button>
                </>
              )}
              <button type="button" className="btn btn-ghost" onClick={addItem}>
                <Plus size={16} /> Adicionar item
              </button>
              {allowNf && importing && (
                <span className="nf-importing">
                  <Loader2 size={14} className="spin" /> Lendo nota…
                </span>
              )}
              {allowNf && (
                <>
                  {/* Camera: abre direto a camera traseira no celular (capture) */}
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    hidden
                    onChange={handleImportFiles}
                  />
                  {/* Galeria / arquivos: permite selecionar varias imagens */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={handleImportFiles}
                  />
                </>
              )}
            </div>
          </div>

          {allowNf && importError && <div className="nf-import-error">{importError}</div>}

          {allowNf && nfImages.length > 0 && (
            <div className="nf-attachments">
              <span className="nf-attachments-label">
                <Paperclip size={14} /> {nfImages.length} nota(s) anexada(s) — irão no PDF
              </span>
              <div className="nf-thumbs">
                {nfImages.map((img) => (
                  <div className="nf-thumb" key={img.id}>
                    <img
                      src={img.dataUrl ?? img.url}
                      alt={img.nf_number ? `NF ${img.nf_number}` : "NF"}
                      title="Clique para abrir"
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        setLightbox({
                          src: img.dataUrl ?? img.url,
                          alt: img.nf_number ? `NF ${img.nf_number}` : "NF",
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setLightbox({
                            src: img.dataUrl ?? img.url,
                            alt: img.nf_number ? `NF ${img.nf_number}` : "NF",
                          });
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="nf-thumb-remove"
                      onClick={() => removeNfImage(img.id)}
                      title="Remover esta nota e seus itens"
                      aria-label="Remover nota"
                    >
                      <X size={12} />
                    </button>
                    <span className="nf-thumb-label">
                      {img.nf_number ? `NF ${img.nf_number}` : "NF"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={`items-table${allowNf ? "" : " items-table--no-nf"}`}>
            <div className="items-row items-row-head" aria-hidden="true">
              <span>QTD</span>
              <span>Item</span>
              {allowNf && <span>Data</span>}
              <span>Valor (R$)</span>
              {allowNf && <span>Nº NF</span>}
              {allowNf && <span>Local</span>}
              <span>Observações</span>
              <span />
            </div>

            {items.map((it, idx) => (
              <div className="items-row" key={it._key}>
                <span className="items-row-num" aria-hidden="true">{idx + 1}</span>
                <label className="item-cell" data-field="QTD">
                  <span className="item-cell-label">QTD</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={it.qty}
                    aria-label={`Quantidade do item ${idx + 1}`}
                    onChange={(e) => patchItem(it._key, { qty: e.target.value })}
                  />
                </label>
                <label className="item-cell" data-field="Item">
                  <span className="item-cell-label">Item</span>
                  <input
                    list="item-suggestions"
                    value={it.description}
                    aria-label={`Descrição do item ${idx + 1}`}
                    onChange={(e) =>
                      patchItem(it._key, { description: e.target.value.toUpperCase() })
                    }
                    placeholder="JANTA, ALMOÇO, UBER…"
                  />
                </label>
                {allowNf && (
                  <label className="item-cell" data-field="Data">
                    <span className="item-cell-label">Data</span>
                    <input
                      type="date"
                      value={it.item_date}
                      aria-label={`Data do item ${idx + 1}`}
                      onChange={(e) => patchItem(it._key, { item_date: e.target.value })}
                    />
                  </label>
                )}
                <label className="item-cell" data-field="Valor">
                  <span className="item-cell-label">Valor (R$)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={it.value}
                    aria-label={`Valor do item ${idx + 1}`}
                    onChange={(e) => patchItem(it._key, { value: e.target.value })}
                    placeholder="0,00"
                  />
                </label>
                {allowNf && (
                  <label className="item-cell" data-field="NF">
                    <span className="item-cell-label">Nº NF</span>
                    <input
                      value={it.nf_number}
                      aria-label={`Número da NF do item ${idx + 1}`}
                      onChange={(e) => patchItem(it._key, { nf_number: e.target.value })}
                      placeholder="Nº NF"
                    />
                  </label>
                )}
                {allowNf && (
                  <label className="item-cell" data-field="Local">
                    <span className="item-cell-label">Local</span>
                    <input
                      value={it.local}
                      aria-label={`Local do item ${idx + 1}`}
                      onChange={(e) => patchItem(it._key, { local: e.target.value })}
                      placeholder="Estabelecimento"
                    />
                  </label>
                )}
                <label className="item-cell" data-field="Observações">
                  <span className="item-cell-label">Observações</span>
                  <input
                    value={it.notes}
                    aria-label={`Observação do item ${idx + 1}`}
                    onChange={(e) => patchItem(it._key, { notes: e.target.value })}
                    placeholder="Observação"
                  />
                </label>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => removeItem(it._key)}
                  disabled={items.length === 1}
                  title="Remover item"
                  aria-label={`Remover item ${idx + 1}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <datalist id="item-suggestions">
            {ITEM_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>

          <div className="items-total">
            <span>Total do {meta.singular}</span>
            <strong>{formatCurrency(total)}</strong>
          </div>

          <FoodOverageNotice items={items} total={total} />
          <ForbiddenItemsNotice items={items} />
        </section>

        {error && <div className="form-error">{error}</div>}

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate(isEdit ? `${meta.base}/${id}` : meta.base)}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {isEdit ? <Send size={16} /> : <Save size={16} />}
            {isEdit
              ? submitting
                ? "Reenviando…"
                : "Reenviar para aprovação"
              : submitting
                ? "Salvando…"
                : `Salvar ${meta.singular}`}
          </button>
        </div>
      </form>

      {showCamera && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}

      {lightbox && (
        <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}
