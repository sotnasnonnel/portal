// E-mail do "Enviar para conhecimento" de um DESLIGAMENTO.
//
// O aviso no sino já nasce na RPC desligamento_enviar_ciencia; aqui só sai o
// e-mail para quem ainda não recebeu (email_enviado_em nulo), então chamar de
// novo não duplica. Um e-mail por pessoa: a lista de avisados não circula.
//
// Sigilo: o e-mail leva nome, função e data prevista — NUNCA a justificativa
// nem a iniciativa. Só um admin do DP que pode ver desligamento dispara.
//
// Body: { solicitacao_id, dry_run? }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

const esc = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

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

/** Moldura padrão do e-mail do DP (mesma da notify-solic-aprovador). */
function moldura(conteudo: string, link: string, phdLogo: string) {
  return `
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
      <tr><td style="padding:26px 26px 8px;color:#1b2735;font-size:15px;line-height:1.55">${conteudo}</td></tr>
      <tr><td style="padding:0 26px 28px"><a href="${link}" style="background:#c35e1e;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px;display:inline-block">Abrir no Portal PHD</a></td></tr>
      <tr><td style="padding:14px 26px;border-top:1px solid #e3e3e3;color:#6b7280;font-size:12px">Portal PHD · PHD Engenharia — e-mail automático, não responda. Informação confidencial: não repasse.</td></tr>
    </table>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    let solicitacao_id: string | null = null;
    let dry_run = false;
    try { ({ solicitacao_id = null, dry_run = false } = await req.json()); } catch { return json({ error: "invalid_body" }, 400); }
    if (!solicitacao_id) return json({ error: "missing_solicitacao_id" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    // Quem chama precisa ser admin do DP com acesso a desligamento.
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: auth } = await supabase.auth.getUser(jwt);
    if (!auth?.user) return json({ error: "unauthorized" }, 401);
    const { data: eu } = await supabase
      .from("colaboradores")
      .select("id, perfil, pode_ver_desligamento")
      .eq("auth_id", auth.user.id)
      .maybeSingle();
    if (!eu || eu.perfil !== "admin" || eu.pode_ver_desligamento === false) return json({ error: "forbidden" }, 403);

    const { data: sol, error: eSol } = await supabase
      .from("solicitacoes_rh")
      .select("id, numero, tipo, status, colaborador_id, justificativa")
      .eq("id", solicitacao_id)
      .maybeSingle();
    if (eSol) return json({ error: eSol.message }, 500);
    if (!sol || sol.tipo !== "desligamento") return json({ skipped: "not_desligamento" });
    if (sol.status === "cancelada") return json({ skipped: "cancelada" });

    const { data: pendentes, error: ePen } = await supabase
      .from("solicitacoes_rh_ciencia")
      .select("id, observacao, enviado_por, destinatario:destinatario_id ( nome, email, ativo )")
      .eq("solicitacao_id", solicitacao_id)
      .is("email_enviado_em", null);
    if (ePen) return json({ error: ePen.message }, 500);
    if (!pendentes?.length) return json({ skipped: "nada_pendente" });

    const ids = [sol.colaborador_id, ...pendentes.map((p) => p.enviado_por)].filter(Boolean);
    const { data: pessoas } = await supabase.from("colaboradores").select("id, nome, funcao").in("id", ids);
    const porId = Object.fromEntries((pessoas ?? []).map((c: { id: string }) => [c.id, c]));
    const colab = porId[sol.colaborador_id] ?? { nome: "—", funcao: null };
    const data = (sol.justificativa ?? "").match(/Data solicitada para desligamento: ([^\n]*)/)?.[1] ?? null;

    const sender = Deno.env.get("GRAPH_SENDER") ?? "sistema@phdengenharia.eng.br";
    const appUrl = (Deno.env.get("PORTAL_URL") ?? "https://portal.phdengenharia.tech").replace(/\/+$/, "");
    const phdLogo = Deno.env.get("LOGO_URL") ?? "https://bogsuuhrgvopzgcceoqz.supabase.co/storage/v1/object/public/public-assets/logo_phd.png";
    const link = `${appUrl}/#/conhecimento`;
    const subject = `Desligamento de ${colab.nome} — para conhecimento`;

    // deno-lint-ignore no-explicit-any
    const comEmail = pendentes.filter((p: any) => p.destinatario?.email && p.destinatario?.ativo !== false);
    if (dry_run) {
      // deno-lint-ignore no-explicit-any
      return json({ would_send: true, to: comEmail.map((p: any) => p.destinatario.email), subject });
    }
    if (!comEmail.length) return json({ skipped: "sem_email" });

    const tenant = Deno.env.get("GRAPH_TENANT_ID");
    const clientId = Deno.env.get("GRAPH_CLIENT_ID");
    const secret = Deno.env.get("GRAPH_CLIENT_SECRET");
    if (!tenant || !clientId || !secret) return json({ error: "graph_not_configured" }, 500);
    const token = await graphToken(tenant, clientId, secret);

    const enviados: string[] = [];
    const falhas: string[] = [];
    for (const p of comEmail) {
      // deno-lint-ignore no-explicit-any
      const dest = (p as any).destinatario;
      const quemEnviou = porId[p.enviado_por]?.nome ?? "o DP";
      const conteudo = `
        <p style="margin:0 0 10px">Olá, <strong>${esc(dest.nome)}</strong>.</p>
        <p style="margin:0 0 16px">${esc(quemEnviou)} enviou para o seu conhecimento um desligamento. Organize o recolhimento de EPIs, equipamentos, acessórios e acessos.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;margin-bottom:14px">
          <tr><td style="color:#6b7280;padding:2px 14px 2px 0">Colaborador</td><td style="color:#1b2735"><strong>${esc(colab.nome)}</strong></td></tr>
          ${colab.funcao ? `<tr><td style="color:#6b7280;padding:2px 14px 2px 0">Função</td><td style="color:#1b2735">${esc(colab.funcao)}</td></tr>` : ""}
          ${data ? `<tr><td style="color:#6b7280;padding:2px 14px 2px 0">Data prevista</td><td style="color:#1b2735"><strong>${esc(data)}</strong></td></tr>` : ""}
        </table>
        ${p.observacao ? `<p style="margin:0 0 16px;padding:10px 12px;background:#f6f7f9;border-radius:8px;font-size:14px"><strong>Observação do DP:</strong> ${esc(p.observacao)}</p>` : ""}
        <p style="margin:0 0 16px;font-size:14px;color:#6b7280">No portal, confirme com o botão <strong>Ciente</strong>.</p>`;

      const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            subject,
            body: { contentType: "HTML", content: moldura(conteudo, link, phdLogo) },
            toRecipients: [{ emailAddress: { address: dest.email } }],
          },
          saveToSentItems: true,
        }),
      });
      if (res.status === 202) {
        enviados.push(p.id);
      } else {
        falhas.push(dest.email);
        console.error("[notify-desligamento-ciencia] graph:", res.status, (await res.text()).slice(0, 300));
      }
    }

    if (enviados.length) {
      await supabase
        .from("solicitacoes_rh_ciencia")
        .update({ email_enviado_em: new Date().toISOString() })
        .in("id", enviados);
    }
    return json({ sent: enviados.length, falhas });
  } catch (e) {
    console.error("[notify-desligamento-ciencia] erro inesperado:", e);
    return json({ error: `unhandled: ${(e as Error)?.message ?? String(e)}` }, 500);
  }
});
