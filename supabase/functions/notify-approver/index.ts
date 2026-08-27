// Avisa o GESTOR por e-mail que há um reembolso/adiantamento para aprovar.
//
// O botão do e-mail aponta para o Portal PHD (rota /#/reembolsos): o app
// deixou de morar em reembolso.phdengenharia.tech quando virou um módulo do
// portal, e o link antigo levava a lugar nenhum.
//
// Body: { id } — id do reembolso.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
const KIND_LABEL: Record<string, string> = { reembolso: "reembolso", adiantamento: "adiantamento" };
// Texto vindo do banco entra em HTML: nome, obra e justificativa são digitados
// pelo usuário. Sem escapar, dava para plantar link ou markup num e-mail que
// sai do endereço oficial da empresa — phishing assinado por nós.
const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const BRL = (v: number | null) => (Number(v ?? 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Rota do módulo dentro do portal (HashRouter). */
function rotaPortal(kind: string) {
  const base = (Deno.env.get("PORTAL_URL") ?? "https://portal.phdengenharia.tech").replace(/\/+$/, "");
  return `${base}/#${kind === "adiantamento" ? "/adiantamentos" : "/reembolsos"}`;
}

async function graphToken(tenant: string, clientId: string, secret: string): Promise<string> {
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: secret, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`token ${res.status}: ${data.error_description ?? JSON.stringify(data)}`);
  return data.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    let id: string | null = null;
    try { ({ id } = await req.json()); } catch { return json({ error: "invalid_body" }, 400); }
    if (!id) return json({ error: "missing_id" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: r, error } = await supabase
      .from("reembolso_reimbursements")
      .select("id, code, kind, status, manager_id, requester_name, client_obra, total, request_date")
      .eq("id", id)
      .maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!r) return json({ skipped: "not_found" });
    if (r.status !== "em_analise" || !r.manager_id) return json({ skipped: "no_approval_needed" });

    const { data: mgr } = await supabase
      .from("reembolso_profiles")
      .select("email, display_name, full_name")
      .eq("id", r.manager_id)
      .maybeSingle();
    if (!mgr?.email) return json({ skipped: "manager_without_email" });

    const tipo = KIND_LABEL[r.kind] ?? "reembolso";
    const tipoTitulo = tipo.charAt(0).toUpperCase() + tipo.slice(1);
    const appUrl = rotaPortal(r.kind);
    const phdLogo = Deno.env.get("LOGO_URL") ?? "https://bogsuuhrgvopzgcceoqz.supabase.co/storage/v1/object/public/public-assets/logo_phd.png";
    const mgrName = mgr.display_name || mgr.full_name || "";
    const subject = `${tipoTitulo} - Aguardando Aprovação`;
    const html = `
  <div style="background:#f2f2f2;padding:24px 0;font-family:Inter,Segoe UI,Arial,sans-serif">
    <table role="presentation" align="center" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:92%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,.08)">
      <tr><td bgcolor="#26405d" style="background:#26405d;padding:18px 22px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td bgcolor="#c35e1e" style="background:#c35e1e;color:#fff;font-weight:800;font-size:13px;border-radius:8px;padding:7px 9px">R$</td>
            <td style="padding-left:10px;color:#fff;font-size:18px;font-weight:800;letter-spacing:.3px">PHD <span style="color:#e8814a">Reembolso</span></td>
          </tr></table></td>
          <td align="right" style="vertical-align:middle"><img src="${phdLogo}" alt="PHD Engenharia" height="22" style="height:22px;opacity:.95"></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:26px 26px 8px;color:#1b2735;font-size:15px;line-height:1.55">
        <p style="margin:0 0 10px">${mgrName ? `Olá, <strong>${esc(mgrName)}</strong>.` : "Olá."}</p>
        <p style="margin:0 0 16px">Chegou uma nova notificação de <strong>${esc(tipo)}</strong> para aprovar.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;margin-bottom:18px">
          <tr><td style="color:#6b7280;padding:2px 14px 2px 0">Solicitante</td><td style="color:#1b2735">${esc(r.requester_name ?? "—")}</td></tr>
          <tr><td style="color:#6b7280;padding:2px 14px 2px 0">Valor</td><td style="color:#1b2735"><strong>${BRL(r.total)}</strong></td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:0 26px 28px"><a href="${appUrl}" style="background:#c35e1e;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px;display:inline-block">Abrir no Portal PHD</a></td></tr>
      <tr><td style="padding:14px 26px;border-top:1px solid #e3e3e3;color:#6b7280;font-size:12px">PHD Reembolso · PHD Engenharia — e-mail automático, não responda.</td></tr>
    </table>
  </div>`;

    const tenant = Deno.env.get("GRAPH_TENANT_ID");
    const clientId = Deno.env.get("GRAPH_CLIENT_ID");
    const secret = Deno.env.get("GRAPH_CLIENT_SECRET");
    const sender = Deno.env.get("GRAPH_SENDER") ?? "sistema@phdengenharia.eng.br";
    if (!tenant || !clientId || !secret) return json({ error: "graph_not_configured" }, 500);

    try {
      const token = await graphToken(tenant, clientId, secret);
      const sendRes = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: { subject, body: { contentType: "HTML", content: html }, toRecipients: [{ emailAddress: { address: mgr.email } }] }, saveToSentItems: true }),
      });
      if (sendRes.status !== 202) {
        const t = await sendRes.text();
        console.error("[notify-approver] graph sendMail:", sendRes.status, t);
        return json({ error: `graph_send_failed: ${sendRes.status} ${t.slice(0, 400)}` }, 502);
      }
    } catch (e) {
      console.error("[notify-approver] graph:", e);
      return json({ error: `graph_error: ${(e as Error)?.message ?? String(e)}` }, 502);
    }
    return json({ sent: true, to: mgr.email });
  } catch (e) {
    console.error("[notify-approver] erro inesperado:", e);
    return json({ error: `unhandled: ${(e as Error)?.message ?? String(e)}` }, 500);
  }
});
