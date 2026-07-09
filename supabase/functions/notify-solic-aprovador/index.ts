// Avisa por e-mail o responsável pela etapa pendente atual de uma requisição DP
// (aprovação ou execução). Mesmo padrão da notify-approver do Reembolso:
// Microsoft Graph sendMail com os secrets GRAPH_* já configurados no projeto.
// Body: { solicitacao_id, dry_run? } — dry_run responde quem receberia, sem enviar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// Espelha TIPO_LABEL de src/config/aprovacao.js.
const TIPO_LABEL: Record<string, string> = {
  aumento_salario: "Alteração de Cargo / Função",
  desligamento: "Desligamento",
  formulario_contratacao: "Formulário de Contratação",
  mapeamento: "Mapeamento",
  ajuda_custo: "Ajuda de Custo",
  nova_vaga: "Nova Vaga",
};

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
    let solicitacao_id: string | null = null;
    let dry_run = false;
    try { ({ solicitacao_id, dry_run = false } = await req.json()); } catch { return json({ error: "invalid_body" }, 400); }
    if (!solicitacao_id) return json({ error: "missing_solicitacao_id" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    const { data: sol, error: eSol } = await supabase
      .from("solicitacoes_rh")
      .select("id, tipo, status, gestor_id, colaborador_id")
      .eq("id", solicitacao_id)
      .maybeSingle();
    if (eSol) return json({ error: eSol.message }, 500);
    if (!sol) return json({ skipped: "not_found" });
    if (sol.status !== "pendente") return json({ skipped: "not_pending" });

    // Etapa da vez: pendente de menor ordem (aprovação ou execução).
    const { data: etapa, error: eEt } = await supabase
      .from("solicitacoes_rh_etapas")
      .select("id, ordem, aprovador_id, papel, tipo_etapa")
      .eq("solicitacao_id", solicitacao_id)
      .eq("status", "pendente")
      .in("tipo_etapa", ["aprovacao", "execucao"])
      .order("ordem", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (eEt) return json({ error: eEt.message }, 500);
    if (!etapa) return json({ skipped: "no_pending_step" });

    const ids = [etapa.aprovador_id, sol.gestor_id, sol.colaborador_id].filter(Boolean);
    const { data: cols, error: eCols } = await supabase
      .from("colaboradores")
      .select("id, nome, email")
      .in("id", ids);
    if (eCols) return json({ error: eCols.message }, 500);
    const porId = Object.fromEntries((cols ?? []).map((c) => [c.id, c]));
    const dest = porId[etapa.aprovador_id];
    if (!dest?.email) return json({ skipped: "approver_without_email" });

    const ehExecucao = etapa.tipo_etapa === "execucao";
    const tipoLabel = TIPO_LABEL[sol.tipo] ?? sol.tipo;
    const solicitante = porId[sol.gestor_id]?.nome ?? "—";
    const colaborador = sol.colaborador_id ? (porId[sol.colaborador_id]?.nome ?? null) : null;
    const acao = ehExecucao ? "Execução" : "Aprovação";
    const subject = `Requisição ${tipoLabel} - Aguardando sua ${acao}`;
    if (dry_run) return json({ would_send: true, to: dest.email, nome: dest.nome, tipo_etapa: etapa.tipo_etapa, subject });

    const appUrl = (Deno.env.get("PORTAL_URL") ?? "https://portal.phdengenharia.tech").replace(/\/+$/, "");
    const phdLogo = Deno.env.get("LOGO_URL") ?? "https://bogsuuhrgvopzgcceoqz.supabase.co/storage/v1/object/public/public-assets/logo_phd.png";
    const html = `
  <div style="background:#f2f2f2;padding:24px 0;font-family:Inter,Segoe UI,Arial,sans-serif">
    <table role="presentation" align="center" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:92%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,.08)">
      <tr><td bgcolor="#26405d" style="background:#26405d;padding:18px 22px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td bgcolor="#c35e1e" style="background:#c35e1e;color:#fff;font-weight:800;font-size:13px;border-radius:8px;padding:7px 9px">DP</td>
            <td style="padding-left:10px;color:#fff;font-size:18px;font-weight:800;letter-spacing:.3px">PHD <span style="color:#e8814a">Portal</span></td>
          </tr></table></td>
          <td align="right" style="vertical-align:middle"><img src="${phdLogo}" alt="PHD Engenharia" height="22" style="height:22px;opacity:.95"></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:26px 26px 8px;color:#1b2735;font-size:15px;line-height:1.55">
        <p style="margin:0 0 10px">Olá, <strong>${dest.nome}</strong>.</p>
        <p style="margin:0 0 16px">Chegou a sua vez de ${ehExecucao ? "executar" : "aprovar"} uma requisição de <strong>${tipoLabel}</strong>.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;margin-bottom:18px">
          <tr><td style="color:#6b7280;padding:2px 14px 2px 0">Solicitante</td><td style="color:#1b2735">${solicitante}</td></tr>
          ${colaborador ? `<tr><td style="color:#6b7280;padding:2px 14px 2px 0">Colaborador</td><td style="color:#1b2735">${colaborador}</td></tr>` : ""}
          <tr><td style="color:#6b7280;padding:2px 14px 2px 0">Etapa</td><td style="color:#1b2735"><strong>${acao}</strong></td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:0 26px 28px"><a href="${appUrl}" style="background:#c35e1e;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px;display:inline-block">Acessar o Portal PHD</a></td></tr>
      <tr><td style="padding:14px 26px;border-top:1px solid #e3e3e3;color:#6b7280;font-size:12px">Portal PHD · PHD Engenharia — e-mail automático, não responda.</td></tr>
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
        body: JSON.stringify({ message: { subject, body: { contentType: "HTML", content: html }, toRecipients: [{ emailAddress: { address: dest.email } }] }, saveToSentItems: true }),
      });
      if (sendRes.status !== 202) {
        const t = await sendRes.text();
        console.error("[notify-solic-aprovador] graph sendMail:", sendRes.status, t);
        return json({ error: `graph_send_failed: ${sendRes.status} ${t.slice(0, 400)}` }, 502);
      }
    } catch (e) {
      console.error("[notify-solic-aprovador] graph:", e);
      return json({ error: `graph_error: ${(e as Error)?.message ?? String(e)}` }, 502);
    }
    return json({ sent: true, to: dest.email, tipo_etapa: etapa.tipo_etapa });
  } catch (e) {
    console.error("[notify-solic-aprovador] erro inesperado:", e);
    return json({ error: `unhandled: ${(e as Error)?.message ?? String(e)}` }, 500);
  }
});
