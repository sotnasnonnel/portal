// Avisa por e-mail o SOLICITANTE quando sua requisição DP é reprovada, com o
// motivo e um convite a responder ("Deseja responder?"). Se ele responder no
// portal, a requisição volta para a decisão de quem reprovou. Espelha
// notify-solic-aprovador (Microsoft Graph, secrets GRAPH_*).
// Body: { solicitacao_id, dry_run? }.
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

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// tipo (solicitacoes_rh) -> slug da rota (src/config/requisicoes.js). Usado para
// levar o solicitante direto ao Histórico do tipo certo, onde fica "Responder".
const TIPO_SLUG: Record<string, string> = {
  aumento_salario: "alteracao",
  desligamento: "desligamento",
  formulario_contratacao: "formulario-contratacao",
  mapeamento: "mapeamento",
  ajuda_custo: "ajuda-custo",
  nova_vaga: "nova-vaga",
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
      .select("id, numero, tipo, status, gestor_id")
      .eq("id", solicitacao_id)
      .maybeSingle();
    if (eSol) return json({ error: eSol.message }, 500);
    if (!sol) return json({ skipped: "not_found" });
    if (sol.status !== "reprovada") return json({ skipped: "not_reprovada" });

    // Etapa que reprovou (a de maior ordem com status 'reprovada'): dá o motivo
    // e quem reprovou.
    const { data: etapa } = await supabase
      .from("solicitacoes_rh_etapas")
      .select("papel, justificativa, ordem")
      .eq("solicitacao_id", solicitacao_id)
      .eq("status", "reprovada")
      .order("ordem", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: gestor, error: eG } = await supabase
      .from("colaboradores").select("nome, email").eq("id", sol.gestor_id).maybeSingle();
    if (eG) return json({ error: eG.message }, 500);
    if (!gestor?.email) return json({ skipped: "requester_without_email" });

    const tipoLabel = TIPO_LABEL[sol.tipo] ?? sol.tipo;
    const porNome = etapa?.papel ?? "um aprovador";
    const motivo = etapa?.justificativa ?? "";
    const numero = sol.numero != null ? `#${sol.numero} ` : "";
    const subject = `Sua requisição ${tipoLabel} ${numero}foi reprovada – Deseja responder?`;
    if (dry_run) return json({ would_send: true, to: gestor.email, nome: gestor.nome, subject, motivo, por: porNome });

    const appUrl = (Deno.env.get("PORTAL_URL") ?? "https://portal.phdengenharia.tech").replace(/\/+$/, "");
    const slug = TIPO_SLUG[sol.tipo];
    // Link direto para o Histórico do tipo, onde o solicitante clica "Responder".
    const respostaUrl = slug ? `${appUrl}/gestor/solicitacoes/nova/${slug}?aba=historico` : appUrl;
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
        <p style="margin:0 0 10px">Olá, <strong>${escapeHtml(gestor.nome ?? "")}</strong>.</p>
        <p style="margin:0 0 16px">Sua requisição de <strong>${tipoLabel}</strong> ${numero}foi <strong>reprovada</strong> por ${escapeHtml(porNome)}. Você pode <strong>responder</strong> — ao reenviar, ela volta para a decisão de quem reprovou, sem abrir outra requisição.</p>
        ${motivo ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:18px"><tr><td style="background:#fdecea;border:1px solid #f5c2bc;border-radius:10px;padding:12px 14px;color:#a12a1c;font-size:14px"><strong>Motivo:</strong><br>${escapeHtml(motivo)}</td></tr></table>` : ""}
      </td></tr>
      <tr><td style="padding:0 26px 28px"><a href="${respostaUrl}" style="background:#c35e1e;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px;display:inline-block">Responder no Portal</a></td></tr>
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
        body: JSON.stringify({ message: { subject, body: { contentType: "HTML", content: html }, toRecipients: [{ emailAddress: { address: gestor.email } }] }, saveToSentItems: true }),
      });
      if (sendRes.status !== 202) {
        const t = await sendRes.text();
        console.error("[notify-solic-reprovada] graph sendMail:", sendRes.status, t);
        return json({ error: `graph_send_failed: ${sendRes.status} ${t.slice(0, 400)}` }, 502);
      }
    } catch (e) {
      console.error("[notify-solic-reprovada] graph:", e);
      return json({ error: `graph_error: ${(e as Error)?.message ?? String(e)}` }, 502);
    }
    return json({ sent: true, to: gestor.email });
  } catch (e) {
    console.error("[notify-solic-reprovada] erro inesperado:", e);
    return json({ error: `unhandled: ${(e as Error)?.message ?? String(e)}` }, 500);
  }
});
