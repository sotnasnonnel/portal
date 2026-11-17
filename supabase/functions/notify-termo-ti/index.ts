// Lembrete diário do TERMO DE RESPONSABILIDADE dos equipamentos de TI.
//
// Quem tem equipamento em uso (ti_ativos: situacao 'Em utilização', responsável
// com e-mail) e ainda não aceitou o termo (situacao_termo <> 'Assinado') recebe
// UM e-mail por dia, até aceitar em /ti/termos. Mesma conta da tela
// (src/modules/ti/lib/regras.js: pendenteTermo).
//
// Quem chama: o pg_cron, uma vez por dia (supabase_cron_ti_termo_lembrete.sql).
// verify_jwt desligado para o cron não precisar guardar chave; por isso a
// função é segura de chamar a qualquer hora: ti_termo_lembretes trava UM envio
// por pessoa por dia, e a resposta não lista nomes nem e-mails.
//
// Só manda para quem está no cadastro e ativo (desligado com equipamento é
// assunto de devolução, não de termo).
//
// Body (opcional): { dry_run?: boolean } — dry_run conta quem receberia, sem enviar.
// (Não há modo de teste para um endereço escolhido: sem login, ele viraria um
// jeito de mandar e-mail em nome do sistema.)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

const escapeHtml = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const hojeBrasil = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

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

type Ativo = { numero_serie: string; tipo: string | null; modelo: string | null };

function montarHtml(nome: string, ativos: Ativo[], dias: number, url: string, logo: string) {
  const itens = ativos
    .map((a) => `<li style="margin:0 0 4px">${escapeHtml([a.tipo, a.modelo].filter(Boolean).join(" · ") || "Equipamento")} — série ${escapeHtml(a.numero_serie)}</li>`)
    .join("");
  const insistencia = dias > 1
    ? `<p style="margin:0 0 16px;color:#a12a1c">Este é o ${dias}º lembrete. O aviso continua chegando todo dia até o aceite.</p>`
    : "";
  return `
  <div style="background:#f2f2f2;padding:24px 0;font-family:Inter,Segoe UI,Arial,sans-serif">
    <table role="presentation" align="center" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:92%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,.08)">
      <tr><td bgcolor="#26405d" style="background:#26405d;padding:18px 22px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td bgcolor="#4f46e5" style="background:#4f46e5;color:#fff;font-weight:800;font-size:12px;border-radius:8px;padding:7px 9px">TI</td>
            <td style="padding-left:10px;color:#fff;font-size:18px;font-weight:800;letter-spacing:.3px">PHD <span style="color:#e8814a">Portal</span></td>
          </tr></table></td>
          <td align="right" style="vertical-align:middle"><img src="${logo}" alt="PHD Engenharia" height="22" style="height:22px;opacity:.95"></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:26px 26px 8px;color:#1b2735;font-size:15px;line-height:1.55">
        <p style="margin:0 0 10px">Olá, <strong>${escapeHtml(nome)}</strong>.</p>
        <p style="margin:0 0 12px">Você está com equipamento(s) da PHD e ainda não aceitou o <strong>termo de responsabilidade</strong>. Leva poucos minutos: abra o portal, leia o termo e clique em <strong>Aceitar termo</strong>.</p>
        <ul style="margin:0 0 16px;padding-left:18px;font-size:14px">${itens}</ul>
        ${insistencia}
      </td></tr>
      <tr><td style="padding:0 26px 28px"><a href="${url}" style="background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px;display:inline-block">Ler e aceitar o termo</a></td></tr>
      <tr><td style="padding:14px 26px;border-top:1px solid #e3e3e3;color:#6b7280;font-size:12px">Portal PHD · TI — e-mail automático, não responda. Equipamento que não está com você? Abra um chamado de TI no Atendimento.</td></tr>
    </table>
  </div>`;
}

const urlTermo = () => `${(Deno.env.get("PORTAL_URL") ?? "https://portal.phdengenharia.tech").replace(/\/+$/, "")}/#/ti/termos`;
const logoUrl = () => Deno.env.get("LOGO_URL") ?? "https://bogsuuhrgvopzgcceoqz.supabase.co/storage/v1/object/public/public-assets/logo_phd.png";

let tokenCache: string | null = null;
async function enviar(para: string, assunto: string, html: string): Promise<{ ok: boolean; status: number; texto: string }> {
  const tenant = Deno.env.get("GRAPH_TENANT_ID");
  const clientId = Deno.env.get("GRAPH_CLIENT_ID");
  const secret = Deno.env.get("GRAPH_CLIENT_SECRET");
  const sender = Deno.env.get("GRAPH_SENDER") ?? "sistema@phdengenharia.eng.br";
  if (!tenant || !clientId || !secret) return { ok: false, status: 500, texto: "graph_not_configured" };
  tokenCache ??= await graphToken(tenant, clientId, secret);
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenCache}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject: assunto,
        body: { contentType: "HTML", content: html },
        toRecipients: [{ emailAddress: { address: para } }],
      },
      saveToSentItems: false,
    }),
  });
  return { ok: res.status === 202, status: res.status, texto: res.status === 202 ? "" : (await res.text()).slice(0, 300) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    let dry_run = false;
    try {
      ({ dry_run = false } = await req.json());
    } catch {
      // corpo vazio: execução normal
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const hoje = hojeBrasil();

    const { data: ativos, error: eAtivos } = await supabase
      .from("ti_ativos")
      .select("numero_serie, tipo, modelo, responsavel, situacao_termo")
      .eq("situacao", "Em utilização")
      .or("situacao_termo.is.null,situacao_termo.neq.Assinado");
    if (eAtivos) return json({ error: eAtivos.message }, 500);

    const porEmail = new Map<string, Ativo[]>();
    for (const a of ativos ?? []) {
      const email = String(a.responsavel ?? "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
      if (!porEmail.has(email)) porEmail.set(email, []);
      porEmail.get(email)!.push(a);
    }
    if (!porEmail.size) return json({ pendentes: 0, enviados: 0 });

    const emails = [...porEmail.keys()];
    const [{ data: pessoas, error: ePessoas }, { data: lembretes, error: eLemb }] = await Promise.all([
      supabase.from("colaboradores").select("nome, email, ativo").not("email", "is", null),
      supabase.from("ti_termo_lembretes").select("pessoa_email, dia").in("pessoa_email", emails),
    ]);
    if (ePessoas) return json({ error: ePessoas.message }, 500);
    if (eLemb) return json({ error: eLemb.message }, 500);

    const cadastro = new Map<string, string>();
    for (const p of pessoas ?? []) {
      if (p.ativo === false) continue;
      cadastro.set(String(p.email).trim().toLowerCase(), p.nome);
    }
    const jaHoje = new Set<string>();
    const enviadosAntes = new Map<string, number>();
    for (const l of lembretes ?? []) {
      if (l.dia === hoje) jaHoje.add(l.pessoa_email);
      enviadosAntes.set(l.pessoa_email, (enviadosAntes.get(l.pessoa_email) ?? 0) + 1);
    }

    const fila = emails.filter((e) => cadastro.has(e) && !jaHoje.has(e));
    if (dry_run) return json({ dry_run: true, pendentes: porEmail.size, enviariam: fila.length, ja_avisados_hoje: jaHoje.size });
    if (!fila.length) return json({ pendentes: porEmail.size, enviados: 0 });

    const url = urlTermo();
    const logo = logoUrl();

    let enviados = 0;
    const falhas: string[] = [];
    for (const email of fila) {
      // Trava o dia ANTES de enviar: se duas execuções correrem juntas, só uma
      // passa do insert (chave pessoa+dia).
      const { error: eTrava } = await supabase.from("ti_termo_lembretes").insert({ pessoa_email: email, dia: hoje });
      if (eTrava) continue;
      const nome = cadastro.get(email)!;
      const dias = (enviadosAntes.get(email) ?? 0) + 1;
      const res = await enviar(
        email,
        dias > 1 ? "Lembrete: aceite o termo de responsabilidade dos seus equipamentos" : "Aceite o termo de responsabilidade dos seus equipamentos",
        montarHtml(nome, porEmail.get(email)!, dias, url, logo),
      );
      if (res.ok) {
        enviados += 1;
      } else {
        // Falhou: solta a trava para a próxima execução tentar de novo.
        await supabase.from("ti_termo_lembretes").delete().eq("pessoa_email", email).eq("dia", hoje);
        falhas.push(`${res.status}`);
        console.error("[notify-termo-ti] sendMail", res.status, res.texto);
      }
    }
    return json({ pendentes: porEmail.size, enviados, falhas: falhas.length });
  } catch (e) {
    console.error("[notify-termo-ti] erro inesperado:", e);
    return json({ error: `unhandled: ${(e as Error)?.message ?? String(e)}` }, 500);
  }
});
