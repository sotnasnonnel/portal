// Avisa o SOLICITANTE por e-mail o desfecho do reembolso/adiantamento.
//
// Antes o e-mail só existia na ida (gestor recebia o pedido). Na volta, quem
// pediu só descobria o resultado abrindo o app — e, no reembolso, a pergunta
// seguinte é sempre a mesma: "quando cai?". Por isso o aprovado leva a DATA DE
// PAGAMENTO junto.
//
// Body: { id } — id do reembolso já decidido.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

const BRL = (v: unknown) => Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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


const dataBr = (d: unknown) => {
  if (!d) return null;
  const p = String(d).slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(d);
};

function rotaPortal(kind: string, id: string) {
  const base = (Deno.env.get("PORTAL_URL") ?? "https://portal.phdengenharia.tech").replace(/\/+$/, "");
  return `${base}/#${kind === "adiantamento" ? "/adiantamentos" : "/reembolsos"}/${id}`;
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
      .select("id, code, kind, status, requester_id, requester_name, total, approved_amount, payment_date, decision_note, decided_by_name, client_obra")
      .eq("id", id)
      .maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!r) return json({ skipped: "not_found" });
    if (r.status !== "aprovado" && r.status !== "reprovado") return json({ skipped: "sem_decisao" });

    const { data: dono } = await supabase
      .from("reembolso_profiles")
      .select("email, display_name, full_name")
      .eq("id", r.requester_id)
      .maybeSingle();
    if (!dono?.email) return json({ skipped: "requester_without_email" });

    const ehAdiantamento = r.kind === "adiantamento";
    const rotulo = ehAdiantamento ? "Adiantamento" : "Reembolso";
    const aprovado = r.status === "aprovado";
    const pago = r.approved_amount != null ? Number(r.approved_amount) : Number(r.total ?? 0);
    const teveDesconto = r.approved_amount != null && Number(r.approved_amount) < Number(r.total ?? 0);
    const cor = aprovado ? "#00a49a" : "#b85236";
    const nome = dono.display_name || dono.full_name || "";
    const subject = `${rotulo} ${r.code ?? ""} - ${aprovado ? "Aprovado" : "Reprovado"}`.replace(/\s+/g, " ");

    // `val` já vem escapado (ou é HTML montado aqui, com número/moeda).
    const linha = (rot: string, val: unknown) =>
      val ? `<tr><td style="color:#6b7280;padding:2px 14px 2px 0">${rot}</td><td style="color:#1b2735">${val}</td></tr>` : "";

    const html = `
  <div style="background:#f2f2f2;padding:24px 0;font-family:Inter,Segoe UI,Arial,sans-serif">
    <table role="presentation" align="center" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:92%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,.08)">
      <tr><td bgcolor="#26405d" style="background:#26405d;padding:18px 22px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td bgcolor="#c35e1e" style="background:#c35e1e;color:#fff;font-weight:800;font-size:13px;border-radius:8px;padding:7px 9px">R$</td>
            <td style="padding-left:10px;color:#fff;font-size:18px;font-weight:800;letter-spacing:.3px">PHD <span style="color:#e8814a">Reembolso</span></td>
          </tr></table></td>
          <td align="right" style="vertical-align:middle"><img src="${Deno.env.get("LOGO_URL") ?? "https://bogsuuhrgvopzgcceoqz.supabase.co/storage/v1/object/public/public-assets/logo_phd.png"}" alt="PHD Engenharia" height="22" style="height:22px;opacity:.95"></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:26px 26px 8px;color:#1b2735;font-size:15px;line-height:1.55">
        <p style="margin:0 0 10px">${nome ? `Olá, <strong>${esc(nome)}</strong>.` : "Olá."}</p>
        <p style="margin:0 0 16px">Seu ${rotulo.toLowerCase()} <strong>${esc(r.code)}</strong> foi
          <strong style="color:${cor}">${aprovado ? "APROVADO" : "REPROVADO"}</strong>${r.decided_by_name ? ` por ${esc(r.decided_by_name)}` : ""}.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;margin-bottom:18px">
          ${linha("Valor solicitado", BRL(r.total))}
          ${aprovado ? linha("Valor aprovado", `<strong>${BRL(pago)}</strong>${teveDesconto ? ` (desconto de ${BRL(Number(r.total) - pago)})` : ""}`) : ""}
          ${aprovado ? linha(ehAdiantamento ? "Data do adiantamento" : "Data de pagamento", dataBr(r.payment_date)) : ""}
          ${!aprovado ? linha("Motivo", esc(r.decision_note)) : ""}
          ${linha("Cliente / Obra", esc(r.client_obra))}
        </table>
        ${aprovado && teveDesconto ? `<p style="margin:0 0 16px;font-size:13px;color:#8a6300;background:#fff3d6;border-radius:10px;padding:10px 12px">O valor aprovado é menor que o solicitado: houve item acima do limite da política de reembolso.</p>` : ""}
        ${aprovado && ehAdiantamento ? `<p style="margin:0 0 16px;font-size:13px;color:#1b2735">Depois de usar o adiantamento, lembre-se de fazer a <strong>prestação de contas</strong> no portal.</p>` : ""}
      </td></tr>
      <tr><td style="padding:0 26px 28px"><a href="${rotaPortal(r.kind, r.id)}" style="background:#c35e1e;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px;display:inline-block">Ver no Portal PHD</a></td></tr>
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
        body: JSON.stringify({ message: { subject, body: { contentType: "HTML", content: html }, toRecipients: [{ emailAddress: { address: dono.email } }] }, saveToSentItems: true }),
      });
      if (sendRes.status !== 202) {
        const t = await sendRes.text();
        console.error("[notify-reembolso-decisao] graph sendMail:", sendRes.status, t);
        return json({ error: `graph_send_failed: ${sendRes.status} ${t.slice(0, 400)}` }, 502);
      }
    } catch (e) {
      console.error("[notify-reembolso-decisao] graph:", e);
      return json({ error: `graph_error: ${(e as Error)?.message ?? String(e)}` }, 502);
    }
    return json({ sent: true, to: dono.email, status: r.status });
  } catch (e) {
    console.error("[notify-reembolso-decisao] erro inesperado:", e);
    return json({ error: `unhandled: ${(e as Error)?.message ?? String(e)}` }, 500);
  }
});
