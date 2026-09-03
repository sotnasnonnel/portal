// Avisa por e-mail quem escreveu no FALE CONOSCO que a mensagem foi respondida.
//
// A notificação do sino (trigger app_private.notif_fale_conosco_respondida)
// só alcança quem volta ao portal. O e-mail leva a resposta inteira até a
// pessoa — é o fechamento do ciclo prometido pelo botão ("resposta em até
// 48h"), e não depende de ela abrir a tela de novo.
//
// Mesmo padrão das outras notificações do portal (Microsoft Graph sendMail com
// os secrets GRAPH_* já configurados no projeto).
//
// Body: { id, dry_run? } — dry_run responde quem receberia, sem enviar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

const TIPO_LABEL: Record<string, string> = { bug: "Bug", melhoria: "Melhoria", elogio: "Elogio" };

const escapeHtml = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// Texto livre vira parágrafo com as quebras de linha preservadas.
const paragrafo = (s: string) => escapeHtml(s).replace(/\r?\n/g, "<br>");

const dataHoraBr = (d: unknown) =>
  (d ? new Date(String(d)).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }) : null);

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

function montarHtml(opts: {
  destNome: string; chamada: string; linhas: Array<[string, unknown]>;
  mensagem: string; resposta: string; respondente: string; url: string; logo: string;
}) {
  const { destNome, chamada, linhas, mensagem, resposta, respondente, url, logo } = opts;
  const linha = (rot: string, val: unknown) =>
    val
      ? `<tr><td style="color:#6b7280;padding:2px 14px 2px 0;vertical-align:top">${rot}</td><td style="color:#1b2735">${escapeHtml(String(val))}</td></tr>`
      : "";
  return `
  <div style="background:#f2f2f2;padding:24px 0;font-family:Inter,Segoe UI,Arial,sans-serif">
    <table role="presentation" align="center" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:92%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,.08)">
      <tr><td bgcolor="#26405d" style="background:#26405d;padding:18px 22px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td bgcolor="#26405d" style="background:#26405d;border:1px solid rgba(255,255,255,.35);color:#fff;font-weight:800;font-size:12px;border-radius:8px;padding:7px 9px">FALE CONOSCO</td>
            <td style="padding-left:10px;color:#fff;font-size:18px;font-weight:800;letter-spacing:.3px">PHD <span style="color:#e8814a">Portal</span></td>
          </tr></table></td>
          <td align="right" style="vertical-align:middle"><img src="${logo}" alt="PHD Engenharia" height="22" style="height:22px;opacity:.95"></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:26px 26px 8px;color:#1b2735;font-size:15px;line-height:1.55">
        <p style="margin:0 0 10px">Olá, <strong>${escapeHtml(destNome)}</strong>.</p>
        <p style="margin:0 0 16px">${chamada}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;margin-bottom:18px">
          ${linhas.map(([rot, val]) => linha(rot, val)).join("")}
        </table>
        <p style="margin:0 0 6px;color:#6b7280;font-size:13px">Você escreveu:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:18px"><tr><td style="background:#f7f7f7;border:1px solid #e3e3e3;border-radius:10px;padding:12px 14px;color:#4b5563;font-size:14px;line-height:1.5">${paragrafo(mensagem)}</td></tr></table>
        <p style="margin:0 0 6px;color:#6b7280;font-size:13px">Resposta de <strong style="color:#1b2735">${escapeHtml(respondente)}</strong>:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:18px"><tr><td style="background:#fff6f0;border:1px solid #f3c9b1;border-radius:10px;padding:12px 14px;color:#1b2735;font-size:14px;line-height:1.5">${paragrafo(resposta)}</td></tr></table>
      </td></tr>
      <tr><td style="padding:0 26px 28px"><a href="${url}" style="background:#26405d;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px;display:inline-block">Ver no Portal PHD</a></td></tr>
      <tr><td style="padding:14px 26px;border-top:1px solid #e3e3e3;color:#6b7280;font-size:12px">Portal PHD · Fale conosco — e-mail automático, não responda. Para continuar a conversa, escreva de novo pelo portal.</td></tr>
    </table>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    let id: string | null = null;
    let dry_run = false;
    try {
      ({ id, dry_run = false } = await req.json());
    } catch {
      return json({ error: "invalid_body" }, 400);
    }
    if (!id) return json({ error: "missing_id" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    const { data: fc, error: eFc } = await supabase
      .from("fale_conosco")
      .select("id, tipo, modulo, mensagem, status, resposta, autor_id, respondido_por, created_at, respondido_em")
      .eq("id", id)
      .maybeSingle();
    if (eFc) return json({ error: eFc.message }, 500);
    if (!fc) return json({ skipped: "not_found" });
    // Só há o que contar depois da resposta.
    if (fc.status !== "respondido" || !fc.resposta) return json({ skipped: "sem_resposta" });

    const ids = [fc.autor_id, fc.respondido_por].filter(Boolean) as string[];
    const { data: pessoas, error: ePessoas } = await supabase
      .from("colaboradores").select("id, nome, email").in("id", ids);
    if (ePessoas) return json({ error: ePessoas.message }, 500);
    const acha = (pid: string | null) => (pid ? pessoas?.find((p) => p.id === pid) ?? null : null);
    const autor = acha(fc.autor_id);
    const respondente = acha(fc.respondido_por);
    if (!autor?.email) return json({ skipped: "autor_sem_email" });

    const appUrl = (Deno.env.get("PORTAL_URL") ?? "https://portal.phdengenharia.tech").replace(/\/+$/, "");
    const logo = Deno.env.get("LOGO_URL") ?? "https://bogsuuhrgvopzgcceoqz.supabase.co/storage/v1/object/public/public-assets/logo_phd.png";
    const tipo = TIPO_LABEL[fc.tipo] ?? fc.tipo;
    const quem = respondente?.nome ?? "A equipe do portal";

    const subject = `Respondemos o seu fale conosco (${tipo.toLowerCase()})`;
    const html = montarHtml({
      destNome: autor.nome,
      chamada: `<strong>${escapeHtml(quem)}</strong> respondeu ao que você enviou pelo Fale conosco do portal.`,
      linhas: [
        ["Tipo", tipo],
        ["Módulo", fc.modulo],
        ["Enviado em", dataHoraBr(fc.created_at)],
        ["Respondido em", dataHoraBr(fc.respondido_em)],
      ],
      mensagem: fc.mensagem ?? "",
      resposta: fc.resposta ?? "",
      respondente: quem,
      url: `${appUrl}/#/fale-conosco`,
      logo,
    });

    if (dry_run) return json({ would_send: true, to: autor.email, nome: autor.nome, subject });

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
        body: JSON.stringify({
          message: {
            subject,
            body: { contentType: "HTML", content: html },
            toRecipients: [{ emailAddress: { address: autor.email } }],
          },
          saveToSentItems: true,
        }),
      });
      if (sendRes.status !== 202) {
        const t = await sendRes.text();
        console.error("[notify-fale-conosco] graph sendMail:", sendRes.status, t);
        return json({ error: `graph_send_failed: ${sendRes.status} ${t.slice(0, 400)}` }, 502);
      }
    } catch (e) {
      console.error("[notify-fale-conosco] graph:", e);
      return json({ error: `graph_error: ${(e as Error)?.message ?? String(e)}` }, 502);
    }

    return json({ sent: true, to: autor.email });
  } catch (e) {
    console.error("[notify-fale-conosco] erro inesperado:", e);
    return json({ error: `unhandled: ${(e as Error)?.message ?? String(e)}` }, 500);
  }
});
