// Avisa por e-mail o ANIVERSARIANTE que um colega deixou recado no mural de
// parabéns do portal (pedido do usuário, 19/10/2026).
//
// O mural vive um dia só: quem não abre o portal no aniversário nunca vê os
// recados. O e-mail leva o recado inteiro e um botão para o mural.
//
// Quem escreveu NÃO vem do corpo do pedido: sai do JWT de quem chamou. O corpo
// traz só o aniversariante (`para`), e o recado é lido no banco — assim o
// e-mail nunca pode dizer que foi outra pessoa que escreveu.
//
// Um e-mail por recado NOVO: o front só chama quando o recado acabou de
// nascer, nunca na edição (ver src/services/notificarParabens.js). Como cada
// pessoa escreve um único recado por aniversário, o aniversariante recebe no
// máximo um e-mail por colega.
//
// Mesmo padrão das outras notificações do portal (Microsoft Graph sendMail com
// os secrets GRAPH_* já configurados no projeto).
//
// Há também o RESUMO, { para, resumo: true }: um e-mail só, com TODOS os
// recados do mural em cartaz. É para quem já tinha recado antes deste aviso
// existir (19/10/2026) e para um reenvio manual; só o super admin do portal
// pode pedir (app_private.is_portal_super_admin, via pontos_meu_resumo).
//
// Body: { para, resumo?, dry_run? } — dry_run responde quem receberia, sem
// enviar.
// DEPLOY: `supabase functions deploy notify-parabens`.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  if (status >= 400) console.error("[notify-parabens]", status, JSON.stringify(body));
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

const escapeHtml = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const paragrafo = (s: string) => escapeHtml(s).replace(/\r?\n/g, "<br>");

// O cadastro guarda o nome em maiúsculas: "ANA CLAUDIA" vira "Ana Claudia",
// como no portal (espelho de src/utils/pessoas.js).
const nomeProprio = (nome: string) =>
  String(nome ?? "").toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase());

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

function montarHtml(opts: { destNome: string; deNome: string; texto: string; total: number; url: string; logo: string }) {
  const { destNome, deNome, texto, total, url, logo } = opts;
  const outros = total - 1;
  const rodapeMural = outros > 0
    ? `<p style="margin:0 0 16px;color:#6b7280;font-size:13px">Seu mural já tem ${total} recados — ${outros === 1 ? "tem mais um" : `tem outros ${outros}`} esperando você no portal.</p>`
    : "";
  return `
  <div style="background:#f2f2f2;padding:24px 0;font-family:Inter,Segoe UI,Arial,sans-serif">
    <table role="presentation" align="center" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:92%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,.08)">
      <tr><td bgcolor="#26405d" style="background:#26405d;padding:18px 22px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td bgcolor="#26405d" style="background:#26405d;border:1px solid rgba(255,255,255,.35);color:#fff;font-weight:800;font-size:12px;border-radius:8px;padding:7px 9px">PARABÉNS</td>
            <td style="padding-left:10px;color:#fff;font-size:18px;font-weight:800;letter-spacing:.3px">PHD <span style="color:#e8814a">Portal</span></td>
          </tr></table></td>
          <td align="right" style="vertical-align:middle"><img src="${logo}" alt="PHD Engenharia" height="22" style="height:22px;opacity:.95"></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:26px 26px 8px;color:#1b2735;font-size:15px;line-height:1.55">
        <p style="margin:0 0 10px">Olá, <strong>${escapeHtml(destNome)}</strong>. 🎉</p>
        <p style="margin:0 0 16px"><strong>${escapeHtml(deNome)}</strong> deixou um recado no seu mural de parabéns no portal.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:18px"><tr><td style="background:#fff6f0;border:1px solid #f3c9b1;border-radius:10px;padding:12px 14px;color:#1b2735;font-size:14px;line-height:1.5">${paragrafo(texto)}</td></tr></table>
        ${rodapeMural}
      </td></tr>
      <tr><td style="padding:0 26px 28px"><a href="${url}" style="background:#26405d;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px;display:inline-block">Ver meu mural no Portal PHD</a></td></tr>
      <tr><td style="padding:14px 26px;border-top:1px solid #e3e3e3;color:#6b7280;font-size:12px">Portal PHD · Mural de parabéns — e-mail automático, não responda.</td></tr>
    </table>
  </div>`;
}

// O resumo: um e-mail com o mural inteiro, um recado embaixo do outro.
function montarHtmlResumo(opts: {
  destNome: string; recados: Array<{ de: string; texto: string }>; url: string; logo: string;
}) {
  const { destNome, recados, url, logo } = opts;
  const quantos = recados.length;
  const cartoes = recados.map((r) => `
        <p style="margin:0 0 4px;color:#6b7280;font-size:13px"><strong style="color:#1b2735">${escapeHtml(r.de)}</strong> escreveu:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:14px"><tr><td style="background:#fff6f0;border:1px solid #f3c9b1;border-radius:10px;padding:12px 14px;color:#1b2735;font-size:14px;line-height:1.5">${paragrafo(r.texto)}</td></tr></table>`).join("");
  return `
  <div style="background:#f2f2f2;padding:24px 0;font-family:Inter,Segoe UI,Arial,sans-serif">
    <table role="presentation" align="center" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:92%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,.08)">
      <tr><td bgcolor="#26405d" style="background:#26405d;padding:18px 22px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td bgcolor="#26405d" style="background:#26405d;border:1px solid rgba(255,255,255,.35);color:#fff;font-weight:800;font-size:12px;border-radius:8px;padding:7px 9px">PARABÉNS</td>
            <td style="padding-left:10px;color:#fff;font-size:18px;font-weight:800;letter-spacing:.3px">PHD <span style="color:#e8814a">Portal</span></td>
          </tr></table></td>
          <td align="right" style="vertical-align:middle"><img src="${logo}" alt="PHD Engenharia" height="22" style="height:22px;opacity:.95"></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:26px 26px 8px;color:#1b2735;font-size:15px;line-height:1.55">
        <p style="margin:0 0 10px">Olá, <strong>${escapeHtml(destNome)}</strong>. 🎉</p>
        <p style="margin:0 0 16px">${quantos === 1 ? "Você tem um recado" : `Você tem ${quantos} recados`} no seu mural de parabéns no portal:</p>
        ${cartoes}
      </td></tr>
      <tr><td style="padding:0 26px 28px"><a href="${url}" style="background:#26405d;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px;display:inline-block">Ver meu mural no Portal PHD</a></td></tr>
      <tr><td style="padding:14px 26px;border-top:1px solid #e3e3e3;color:#6b7280;font-size:12px">Portal PHD · Mural de parabéns — e-mail automático, não responda.</td></tr>
    </table>
  </div>`;
}

// O envio em si, igual nos dois modos.
async function enviar(to: string, subject: string, html: string) {
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
        message: { subject, body: { contentType: "HTML", content: html }, toRecipients: [{ emailAddress: { address: to } }] },
        saveToSentItems: true,
      }),
    });
    if (sendRes.status !== 202) {
      const t = await sendRes.text();
      return json({ error: `graph_send_failed: ${sendRes.status} ${t.slice(0, 400)}` }, 502);
    }
  } catch (e) {
    console.error("[notify-parabens] graph:", e);
    return json({ error: `graph_error: ${(e as Error)?.message ?? String(e)}` }, 502);
  }
  return json({ sent: true, to });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    let para: string | null = null;
    let dry_run = false;
    let resumo = false;
    try {
      ({ para = null, dry_run = false, resumo = false } = await req.json());
    } catch {
      return json({ error: "invalid_body" }, 400);
    }
    if (!para) return json({ error: "missing_para" }, 400);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!/^Bearer\s+\S+/i.test(authHeader)) return json({ error: "sem_token" }, 401);
    const portalUrl = Deno.env.get("SUPABASE_URL")!;
    const comoUsuario = createClient(portalUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: dadosUser, error: eUser } = await comoUsuario.auth.getUser();
    const authId = dadosUser?.user?.id;
    if (eUser || !authId) return json({ error: "sem_token" }, 401);

    const supabase = createClient(portalUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    const { data: de, error: eDe } = await supabase
      .from("colaboradores").select("id, nome").eq("auth_id", authId).maybeSingle();
    if (eDe) return json({ error: eDe.message }, 500);
    if (!de) return json({ skipped: "sem_colaborador" });

    const appUrl = (Deno.env.get("PORTAL_URL") ?? "https://portal.phdengenharia.tech").replace(/\/+$/, "");
    const logo = Deno.env.get("LOGO_URL") ?? "https://bogsuuhrgvopzgcceoqz.supabase.co/storage/v1/object/public/public-assets/logo_phd.png";

    const { data: aniversariante, error: eAniv } = await supabase
      .from("colaboradores").select("id, nome, email").eq("id", para).maybeSingle();
    if (eAniv) return json({ error: eAniv.message }, 500);
    if (!aniversariante?.email) return json({ skipped: "aniversariante_sem_email" });
    const destNome = nomeProprio(aniversariante.nome).split(" ")[0];

    // ---------------------------------------------------------------------
    // Resumo: o mural inteiro num e-mail, só para o super admin do portal.
    // ---------------------------------------------------------------------
    if (resumo) {
      const { data: meu } = await comoUsuario.rpc("pontos_meu_resumo");
      if (!meu?.pode_creditar) return json({ error: "so_super_admin" }, 403);

      // O mural do aniversário EM CARTAZ: a mesma RPC da tela, com o JWT de
      // quem pediu, para a janela do fim de semana valer igual.
      const { data: mural, error: eMural } = await comoUsuario.rpc("parabens_mural", { p_para: para });
      if (eMural) return json({ error: eMural.message }, 500);
      const recados = (mural ?? []) as Array<{ de_nome: string; texto: string }>;
      if (recados.length === 0) return json({ skipped: "mural_vazio" });

      const subject = recados.length === 1
        ? "🎉 Você tem um recado no seu mural de parabéns"
        : `🎉 Você tem ${recados.length} recados no seu mural de parabéns`;
      const html = montarHtmlResumo({
        destNome,
        recados: recados.map((r) => ({ de: nomeProprio(r.de_nome), texto: r.texto ?? "" })),
        url: `${appUrl}/#/`,
        logo,
      });
      if (dry_run) return json({ would_send: true, to: aniversariante.email, subject, recados: recados.length });
      return await enviar(aniversariante.email, subject, html);
    }

    if (de.id === para) return json({ skipped: "recado_para_si" });

    // O recado que acabou de ser gravado — lido no banco, nunca do pedido.
    const { data: recado, error: eRecado } = await supabase
      .from("parabens_recados").select("id, texto, ano, criado_em")
      .eq("para_id", para).eq("de_id", de.id)
      .order("criado_em", { ascending: false }).limit(1).maybeSingle();
    if (eRecado) return json({ error: eRecado.message }, 500);
    if (!recado) return json({ skipped: "sem_recado" });

    // Quantos recados o mural já tem, para o convite falar dos outros também.
    const { count } = await supabase
      .from("parabens_recados").select("id", { count: "exact", head: true })
      .eq("para_id", para).eq("ano", recado.ano);

    const deNome = nomeProprio(de.nome);

    const subject = `🎉 ${deNome} deixou um recado no seu mural de parabéns`;
    const html = montarHtml({
      destNome,
      deNome,
      texto: recado.texto ?? "",
      total: count ?? 1,
      url: `${appUrl}/#/`,
      logo,
    });

    if (dry_run) return json({ would_send: true, to: aniversariante.email, subject });
    return await enviar(aniversariante.email, subject, html);
  } catch (e) {
    console.error("[notify-parabens] erro inesperado:", e);
    return json({ error: `unhandled: ${(e as Error)?.message ?? String(e)}` }, 500);
  }
});
