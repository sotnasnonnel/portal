import { supabase } from "../lib/supabase.js";
import { cachedQuery, invalidateCache } from "../lib/supabaseCache.js";
import { uploadNfImage, signedUrl, removeNfImages } from "./nfStorage.js";
import { computePaymentDate } from "../lib/reimbursementPolicy.js";

// Prefixos de cache. Chaves de list/detail incluem o userId porque o que cada
// um vê depende da RLS (auth.uid) — evita servir dados de um usuário para outro.
const LIST_PREFIX = "reembolso:list:";
const DETAIL_PREFIX = "reembolso:detail:";
const GESTORES_KEY = "reembolso:gestores";

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? "anon";
}

// Toda escrita zera as listas e os detalhes em cache (de qualquer usuário).
function invalidateReimbursements() {
  invalidateCache([LIST_PREFIX, DETAIL_PREFIX]);
}

export const STATUS = {
  EM_ANALISE: "em_analise",
  APROVADO: "aprovado",
  REPROVADO: "reprovado",
  CANCELADO: "cancelado",
};

// Valor efetivamente aprovado/pago: o aprovado (com ou sem desconto) ou, na
// falta dele (registros antigos), o total cheio.
export function paidAmount(r) {
  return r?.approved_amount != null ? Number(r.approved_amount) : Number(r?.total || 0);
}

export const STATUS_LABEL = {
  em_analise: "Aguardando Aprovação",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
  cancelado: "Cancelado",
};

const TBL = "reembolso_reimbursements";
const ITEMS = "reembolso_items";
const NFIMG = "reembolso_nf_images";

// A visibilidade (solicitante / gestor / admin) é garantida pela RLS no banco,
// então aqui só listamos — o Postgres filtra as linhas permitidas.
export async function listReimbursements({ status, kind } = {}) {
  // Cacheia a busca completa (por usuário/status); o filtro de `kind` é aplicado
  // depois, então reembolsos e adiantamentos compartilham a mesma ida ao banco.
  const uid = await currentUserId();
  const key = `${LIST_PREFIX}${uid}:${status || "all"}`;
  const { data, error } = await cachedQuery(
    key,
    () => {
      let query = supabase.from(TBL).select("*").order("created_at", { ascending: false });
      if (status) query = query.eq("status", status);
      return query;
    },
    30_000,
    { staleTtlMs: 10 * 60_000 }
  );
  let rows = data ?? [];
  // filtro de tipo client-side: registros sem `kind` contam como 'reembolso'
  // (mantém o app funcionando mesmo antes de rodar a migration 0004).
  if (kind) rows = rows.filter((r) => (r.kind ?? "reembolso") === kind);
  return { data: rows, error };
}

export async function getReimbursement(id) {
  // staleTtl curto (8 min) fica bem abaixo da validade das URLs assinadas (1h),
  // então nenhuma imagem cacheada vence antes de ser revalidada.
  const uid = await currentUserId();
  const key = `${DETAIL_PREFIX}${uid}:${id}`;
  return cachedQuery(
    key,
    async () => {
      const { data: header, error } = await supabase
        .from(TBL)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) return { data: null, error };
      if (!header) return { data: null, error: { message: "not_found" } };

      const { data: items } = await supabase
        .from(ITEMS)
        .select("*")
        .eq("reimbursement_id", id)
        .order("sort_order", { ascending: true });

      const { data: nfRows } = await supabase
        .from(NFIMG)
        .select("*")
        .eq("reimbursement_id", id)
        .order("created_at", { ascending: true });

      // bucket é privado -> gera URL assinada por imagem
      const nf_images = [];
      for (const row of nfRows ?? []) {
        let url = null;
        try {
          url = await signedUrl(row.storage_path);
        } catch {
          /* segue sem a imagem */
        }
        nf_images.push({
          id: row.id,
          nf_number: row.nf_number,
          local: row.local,
          data_nf: row.data_nf,
          total: row.total,
          storage_path: row.storage_path,
          is_accountability: row.is_accountability ?? false,
          ref: url ? { kind: "url", value: url } : null,
        });
      }

      return { data: { ...header, items: items ?? [], nf_images }, error: null };
    },
    30_000,
    { staleTtlMs: 8 * 60_000 }
  );
}

export async function createReimbursement({ header, items, nfImages }) {
  // 1. cabeçalho — `code` e `total` são preenchidos por triggers no banco.
  //    status/decisão são opcionais: o pedido de gestor já entra aprovado.
  const { data: created, error } = await supabase
    .from(TBL)
    .insert({
      requester_id: header.requester_id,
      requester_name: header.requester_name,
      manager_id: header.manager_id ?? null,
      manager_name: header.manager_name ?? null,
      request_date: header.request_date,
      client_obra: header.client_obra,
      pix_key: header.pix_key ?? null,
      notes: header.notes ?? null,
      // só envia kind quando for adiantamento (reembolso usa o default da coluna,
      // mantendo a criação compatível antes da migration 0004)
      ...(header.kind && header.kind !== "reembolso" ? { kind: header.kind } : {}),
      // adiantamento: a data de pagamento é a informada pelo solicitante
      ...(header.payment_date ? { payment_date: header.payment_date } : {}),
      ...(header.status ? { status: header.status } : {}),
      ...(header.decided_at
        ? {
            decided_by_id: header.decided_by_id ?? null,
            decided_by_name: header.decided_by_name ?? null,
            decided_at: header.decided_at,
            // autoaprovação: usa a data informada (adiantamento) ou a regra (reembolso)
            payment_date: header.payment_date ?? computePaymentDate(header.decided_at),
          }
        : {}),
    })
    .select()
    .single();
  if (error) return { data: null, error };

  // 2. imagens de NF -> Storage + linhas (mapeia id temporário do form -> id do banco)
  const nfIdMap = {};
  for (let i = 0; i < (nfImages ?? []).length; i++) {
    const img = nfImages[i];
    try {
      const path = await uploadNfImage(img.dataUrl, { reimbursementId: created.id, index: i });
      const { data: row, error: nfErr } = await supabase
        .from(NFIMG)
        .insert({
          reimbursement_id: created.id,
          storage_path: path,
          nf_number: img.nf_number || null,
          local: img.local || null,
          data_nf: img.data_nf || null,
          total: img.total ?? null,
        })
        .select()
        .single();
      if (!nfErr && row) nfIdMap[img.id] = row.id;
    } catch (err) {
      console.warn("[nf] upload falhou:", err.message);
    }
  }

  // 3. itens
  if ((items ?? []).length > 0) {
    const rows = items.map((it, index) => ({
      reimbursement_id: created.id,
      nf_image_id: it.nf_ref ? nfIdMap[it.nf_ref] ?? null : null,
      sort_order: index,
      qty: Number(it.qty || 1),
      description: it.description,
      item_date: it.item_date || null,
      value: Number(it.value || 0),
      nf_number: it.nf_number ?? null,
      local: it.local ?? null,
      notes: it.notes ?? null,
      meal_category: it.meal_category ?? null,
    }));
    const { error: itErr } = await supabase.from(ITEMS).insert(rows);
    if (itErr) return { data: null, error: itErr };
  }

  invalidateReimbursements();
  return getReimbursement(created.id);
}

// Edita um reembolso e o reenvia para aprovação (usado quando foi reprovado).
// Substitui os itens, aplica adição/remoção de NFs, e volta o status para
// 'em_analise' limpando a decisão anterior e incrementando a REV.
export async function updateReimbursement(id, { header, items, nfImages, removedNfImageIds }) {
  // 1. remove NFs marcadas (linha do banco + arquivo no storage)
  if ((removedNfImageIds ?? []).length > 0) {
    const { data: rows } = await supabase
      .from(NFIMG)
      .select("storage_path")
      .in("id", removedNfImageIds);
    await supabase.from(NFIMG).delete().in("id", removedNfImageIds);
    const paths = (rows ?? []).map((r) => r.storage_path).filter(Boolean);
    if (paths.length) {
      try {
        await removeNfImages(paths);
      } catch {
        /* limpeza de storage é best-effort */
      }
    }
  }

  // 2. novas NFs (só as adicionadas nesta edição têm dataUrl) -> upload + linha
  const nfIdMap = {};
  const newImgs = (nfImages ?? []).filter((img) => img.dataUrl);
  for (let i = 0; i < newImgs.length; i++) {
    const img = newImgs[i];
    try {
      const path = await uploadNfImage(img.dataUrl, { reimbursementId: id, index: Date.now() + i });
      const { data: row, error: nfErr } = await supabase
        .from(NFIMG)
        .insert({
          reimbursement_id: id,
          storage_path: path,
          nf_number: img.nf_number || null,
          local: img.local || null,
          data_nf: img.data_nf || null,
          total: img.total ?? null,
        })
        .select()
        .single();
      if (!nfErr && row) nfIdMap[img.id] = row.id;
    } catch (err) {
      console.warn("[nf] upload falhou:", err.message);
    }
  }

  // 3. itens: substitui o conjunto (delete + insert). O total é recalculado por trigger.
  const { error: delErr } = await supabase.from(ITEMS).delete().eq("reimbursement_id", id);
  if (delErr) return { data: null, error: delErr };
  if ((items ?? []).length > 0) {
    const rows = items.map((it, index) => ({
      reimbursement_id: id,
      // mantém o vínculo com a NF existente, ou aponta para a recém-enviada
      nf_image_id: it.nf_image_id ?? (it.nf_ref ? nfIdMap[it.nf_ref] ?? null : null),
      sort_order: index,
      qty: Number(it.qty || 1),
      description: it.description,
      item_date: it.item_date || null,
      value: Number(it.value || 0),
      nf_number: it.nf_number ?? null,
      local: it.local ?? null,
      notes: it.notes ?? null,
      meal_category: it.meal_category ?? null,
    }));
    const { error: itErr } = await supabase.from(ITEMS).insert(rows);
    if (itErr) return { data: null, error: itErr };
  }

  // 4. cabeçalho + reenvio (status volta a em_analise, zera a decisão, sobe a REV)
  const { error: hErr } = await supabase
    .from(TBL)
    .update({
      request_date: header.request_date,
      client_obra: header.client_obra,
      manager_id: header.manager_id ?? null,
      manager_name: header.manager_name ?? null,
      pix_key: header.pix_key ?? null,
      notes: header.notes ?? null,
      status: STATUS.EM_ANALISE,
      decision_note: null,
      decided_by_id: null,
      decided_by_name: null,
      decided_at: null,
      ...(header.rev ? { rev: header.rev } : {}),
      // adiantamento: atualiza a data informada pelo solicitante
      ...(header.payment_date !== undefined ? { payment_date: header.payment_date } : {}),
    })
    .eq("id", id);
  if (hErr) return { data: null, error: hErr };

  invalidateReimbursements();
  return getReimbursement(id);
}

export async function updateReimbursementStatus(id, status, actor, note, approvedAmount = null, kind = null) {
  const patch = { status };
  if (status === STATUS.APROVADO || status === STATUS.REPROVADO) {
    patch.decided_by_id = actor?.id ?? null;
    patch.decided_by_name = actor?.display_name || actor?.full_name || null;
    patch.decided_at = new Date().toISOString();
    // justificativa só faz sentido na reprovação; ao aprovar, limpa qualquer anterior
    patch.decision_note = status === STATUS.REPROVADO ? note?.trim() || null : null;
    if (status === STATUS.APROVADO) {
      // reembolso: data de pagamento pela regra automática de aprovação.
      // adiantamento: mantém a data que o solicitante informou (não sobrescreve).
      if (kind !== "adiantamento") patch.payment_date = computePaymentDate(patch.decided_at);
      // valor aprovado/pago (total cheio ou com desconto do excedente)
      patch.approved_amount = approvedAmount != null ? Number(approvedAmount) : null;
      // adiantamento aprovado entra em prestação de contas; reembolso fica NULL
      if (kind === "adiantamento") patch.accountability_status = "pendente";
    } else {
      // reprovação: zera qualquer valor aprovado anterior
      patch.approved_amount = null;
    }
  }
  const { data, error } = await supabase
    .from(TBL)
    .update(patch)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (!error) invalidateReimbursements();
  return { data, error };
}

// Avisa o gestor por e-mail que há um item para aprovar (Edge Function).
// Best-effort: nunca bloqueia nem quebra o fluxo se o e-mail falhar.
export async function notifyApprover(id) {
  try {
    await supabase.functions.invoke("notify-approver", { body: { id } });
  } catch (err) {
    console.warn("[notify-approver] falhou:", err?.message);
  }
}

// Lista de gestores (id + nome) para o solicitante escolher o gestor imediato.
// Catálogo que muda pouco -> TTL longo.
export async function listGestores() {
  const { data, error } = await cachedQuery(
    GESTORES_KEY,
    () =>
      supabase
        .from("reembolso_gestores")
        .select("id, full_name, display_name")
        .order("full_name", { ascending: true }),
    5 * 60_000,
    { staleTtlMs: 60 * 60_000 }
  );
  return { data: data ?? [], error };
}

export async function cancelReimbursement(id) {
  const { data, error } = await supabase
    .from(TBL)
    .update({ status: STATUS.CANCELADO })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (!error) invalidateReimbursements();
  return { data, error };
}

export async function deleteReimbursement(id) {
  // pega os paths antes de excluir (o cascade do banco remove as linhas)
  const { data: nfRows } = await supabase.from(NFIMG).select("storage_path").eq("reimbursement_id", id);
  const paths = (nfRows ?? []).map((r) => r.storage_path).filter(Boolean);

  const { error } = await supabase.from(TBL).delete().eq("id", id);
  if (!error) {
    invalidateReimbursements();
    if (paths.length) {
      try {
        await removeNfImages(paths);
      } catch {
        /* limpeza de storage é best-effort */
      }
    }
  }
  return { data: null, error };
}

// === Prestação de contas do adiantamento ===
// Notas de prestação são itens/nf com is_accountability=true; ficam separadas
// dos itens do pedido (false). O accountability_total é mantido pela trigger.

// Substitui o conjunto de NOTAS de prestação (não toca nos itens do pedido).
// Mantém o accountability_status atual (rascunho).
export async function saveAccountability(id, { items, nfImages, removedNfImageIds }) {
  // 1. remove notas de prestação marcadas (linha + storage)
  if ((removedNfImageIds ?? []).length > 0) {
    const { data: rows } = await supabase
      .from(NFIMG)
      .select("storage_path")
      .in("id", removedNfImageIds);
    await supabase.from(NFIMG).delete().in("id", removedNfImageIds);
    const paths = (rows ?? []).map((r) => r.storage_path).filter(Boolean);
    if (paths.length) {
      try {
        await removeNfImages(paths);
      } catch {
        /* limpeza best-effort */
      }
    }
  }

  // 2. novas notas (só as adicionadas têm dataUrl) -> upload + linha
  const nfIdMap = {};
  const newImgs = (nfImages ?? []).filter((img) => img.dataUrl);
  for (let i = 0; i < newImgs.length; i++) {
    const img = newImgs[i];
    try {
      const path = await uploadNfImage(img.dataUrl, { reimbursementId: id, index: Date.now() + i });
      const { data: row, error: nfErr } = await supabase
        .from(NFIMG)
        .insert({
          reimbursement_id: id,
          storage_path: path,
          nf_number: img.nf_number || null,
          local: img.local || null,
          data_nf: img.data_nf || null,
          total: img.total ?? null,
          is_accountability: true,
        })
        .select()
        .single();
      if (!nfErr && row) nfIdMap[img.id] = row.id;
    } catch (err) {
      console.warn("[nf prestação] upload falhou:", err.message);
    }
  }

  // 3. substitui apenas os itens de prestação (is_accountability=true)
  const { error: delErr } = await supabase
    .from(ITEMS)
    .delete()
    .eq("reimbursement_id", id)
    .eq("is_accountability", true);
  if (delErr) return { data: null, error: delErr };

  if ((items ?? []).length > 0) {
    const rows = items.map((it, index) => ({
      reimbursement_id: id,
      nf_image_id: it.nf_image_id ?? (it.nf_ref ? nfIdMap[it.nf_ref] ?? null : null),
      sort_order: index,
      qty: Number(it.qty || 1),
      description: it.description,
      item_date: it.item_date || null,
      value: Number(it.value || 0),
      nf_number: it.nf_number ?? null,
      local: it.local ?? null,
      notes: it.notes ?? null,
      meal_category: it.meal_category ?? null,
      is_accountability: true,
    }));
    const { error: itErr } = await supabase.from(ITEMS).insert(rows);
    if (itErr) return { data: null, error: itErr };
  }

  invalidateReimbursements();
  return getReimbursement(id);
}

// Envia a prestação para análise do gestor.
export async function submitAccountability(id) {
  const { data, error } = await supabase
    .from(TBL)
    .update({
      accountability_status: "em_analise",
      accountability_submitted_at: new Date().toISOString(),
      accountability_note: null,
    })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (!error) invalidateReimbursements();
  return { data, error };
}

// Decisão do gestor: 'aceitar' fecha (acertado); 'devolver' volta para pendente
// com o motivo. settlementWhenZero é gravado quando sobra/falta = 0 ao aceitar.
export async function decideAccountability(id, decision, { note, settlementWhenZero } = {}) {
  let patch;
  if (decision === "aceitar") {
    patch = {
      accountability_status: "acertado",
      accountability_decided_at: new Date().toISOString(),
      accountability_note: null,
    };
    if (settlementWhenZero) {
      patch.settlement = "sem_acerto";
      patch.settlement_at = new Date().toISOString();
    }
  } else {
    patch = {
      accountability_status: "pendente",
      accountability_note: note?.trim() || null,
    };
  }
  const { data, error } = await supabase.from(TBL).update(patch).eq("id", id).select().maybeSingle();
  if (!error) invalidateReimbursements();
  return { data, error };
}

// Marca o acerto financeiro da sobra/falta.
export async function markSettlement(id, settlement) {
  const { data, error } = await supabase
    .from(TBL)
    .update({ settlement, settlement_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (!error) invalidateReimbursements();
  return { data, error };
}
