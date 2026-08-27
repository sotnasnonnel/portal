// Avisa por e-mail o responsável pela etapa pendente atual de uma solicitação do
// Financeiro (aprovação ou execução). Mesmo padrão da notify-solic-aprovador do
// DP: Microsoft Graph sendMail com os secrets GRAPH_* já configurados no projeto.
//
// Diferença do DP: a etapa de EXECUÇÃO do Financeiro é única e tem aprovador_id
// NULO (qualquer admin do Financeiro executa). Nesse caso avisamos TODOS os
// admins do Financeiro (as executoras), um e-mail personalizado para cada.
//
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

// Espelha TIPO_LABEL_FIN de src/config/aprovacaoFinanceiro.js.
const TIPO_LABEL: Record<string, string> = {
  cartao_virtual: "Cartão",
  aumento_limite: "Aumento de Limite",
};

// Espelha modalidadeCartaoLabel/PRAZO_CARTAO_FISICO de src/config/financeiro.js.
const modalidadeLabel = (v: unknown) => (v === "fisico" ? "Cartão físico" : "Cartão virtual");
const PRAZO_CARTAO_FISICO = "Estimativa de 10 dias úteis para entrega.";

const brl = (v: unknown) =>
  v == null ? null : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const dataBr = (d: unknown) => {
  if (!d) return null;
  const s = String(d).slice(0, 10).split("-");
  return s.length === 3 ? `${s[2]}/${s[1]}/${s[0]}` : String(d);
};

// Vigência: vitalício, range (cartão) ou data única (aumento de limite).
const vigencia = (sol: Record<string, unknown>) => {
  if (sol.vitalicio) return "Vitalício";
  if (sol.periodo_inicio || sol.periodo_fim) {
    return `${dataBr(sol.periodo_inicio) ?? "—"} até ${dataBr(sol.periodo_fim) ?? "—"}`;
  }
  return dataBr(sol.periodo);
};

const listaAplic = (v: unknown) => (Array.isArray(v) && v.length ? v.join(", ") : null);

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

type Dest = { id: string; nome: string; email: string };

function montarHtml(opts: {
  dest: Dest; ehExecucao: boolean; tipoLabel: string; numero: number | null;
  solicitante: string; sol: Record<string, unknown>; appUrl: string; logo: string;
}) {
  const { dest, ehExecucao, tipoLabel, numero, solicitante, sol, appUrl, logo } = opts;
  const ehAumento = sol.tipo === "aumento_limite";
  const linha = (rot: string, val: unknown) =>
    val ? `<tr><td style="color:#6b7280;padding:2px 14px 2px 0">${rot}</td><td style="color:#1b2735">${val}</td></tr>` : "";
  return `
  <div style="background:#f2f2f2;padding:24px 0;font-family:Inter,Segoe UI,Arial,sans-serif">
    <table role="presentation" align="center" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:92%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,.08)">
      <tr><td bgcolor="#26405d" style="background:#26405d;padding:18px 22px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td bgcolor="#0f766e" style="background:#0f766e;color:#fff;font-weight:800;font-size:12px;border-radius:8px;padding:7px 9px">FIN</td>
            <td style="padding-left:10px;color:#fff;font-size:18px;font-weight:800;letter-spacing:.3px">PHD <span style="color:#e8814a">Portal</span></td>
          </tr></table></td>
          <td align="right" style="vertical-align:middle"><img src="${logo}" alt="PHD Engenharia" height="22" style="height:22px;opacity:.95"></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:26px 26px 8px;color:#1b2735;font-size:15px;line-height:1.55">
        <p style="margin:0 0 10px">Olá, <strong>${dest.nome}</strong>.</p>
        <p style="margin:0 0 16px">Chegou a sua vez de ${ehExecucao ? "executar" : "aprovar"} uma solicitação de <strong>${tipoLabel}</strong>${numero != null ? ` (#${numero})` : ""}.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;margin-bottom:18px">
          ${linha("Solicitante", solicitante)}
          ${linha(ehAumento ? "Cartão" : "Descrição do cartão", sol.nome_despesa)}
          ${ehAumento ? "" : linha("Tipo de cartão", modalidadeLabel(sol.modalidade_cartao))}
          ${ehAumento || sol.modalidade_cartao !== "fisico" ? "" : linha("Endereço de entrega", String(sol.endereco_entrega ?? "").replace(/\n/g, "<br>"))}
          ${ehAumento || sol.modalidade_cartao !== "fisico" ? "" : linha("Prazo de entrega", PRAZO_CARTAO_FISICO)}
          ${linha("Centro de custo", sol.centro_custo)}
          ${linha(ehAumento ? "Novo limite total" : "Valor", brl(sol.valor))}
          ${linha("Vigência", vigencia(sol))}
          ${linha("Aplicação", listaAplic(sol.aplicacao))}
          <tr><td style="color:#6b7280;padding:2px 14px 2px 0">Etapa</td><td style="color:#1b2735"><strong>${ehExecucao ? "Execução" : "Aprovação"}</strong></td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:0 26px 28px"><a href="${appUrl}" style="background:#0f766e;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px;display:inline-block">Acessar o Portal PHD</a></td></tr>
      <tr><td style="padding:14px 26px;border-top:1px solid #e3e3e3;color:#6b7280;font-size:12px">Portal PHD · Financeiro — e-mail automático, não responda.</td></tr>
    </table>
  </div>`;
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
      .from("solicitacoes_financeiro")
      .select("id, numero, tipo, status, solicitante_id, nome_despesa, centro_custo, valor, periodo, vitalicio, periodo_inicio, periodo_fim, aplicacao, modalidade_cartao, endereco_entrega")
      .eq("id", solicitacao_id)
      .maybeSingle();
    if (eSol) return json({ error: eSol.message }, 500);
    if (!sol) return json({ skipped: "not_found" });
    if (sol.status !== "pendente") return json({ skipped: "not_pending" });

    // Etapa da vez: pendente de menor ordem (aprovação ou execução).
    const { data: etapa, error: eEt } = await supabase
      .from("solicitacoes_financeiro_etapas")
      .select("id, ordem, aprovador_id, papel, tipo_etapa")
      .eq("solicitacao_id", solicitacao_id)
      .eq("status", "pendente")
      .in("tipo_etapa", ["aprovacao", "execucao"])
      .order("ordem", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (eEt) return json({ error: eEt.message }, 500);
    if (!etapa) return json({ skipped: "no_pending_step" });

    const ehExecucao = etapa.tipo_etapa === "execucao";

    // Destinatários: aprovador nomeado, ou (execução aberta) todos os admins do Financeiro.
    let destinatarios: Dest[] = [];
    if (etapa.aprovador_id) {
      const { data } = await supabase.from("colaboradores").select("id, nome, email").eq("id", etapa.aprovador_id).maybeSingle();
      if (data?.email) destinatarios = [data as Dest];
    } else if (ehExecucao) {
      const { data } = await supabase
        .from("colaboradores")
        .select("id, nome, email")
        .eq("financeiro_role", "admin")
        .eq("ativo", true)
        .not("email", "is", null);
      destinatarios = (data ?? []) as Dest[];
    }
    if (destinatarios.length === 0) return json({ skipped: "no_recipients" });

    const { data: quem } = await supabase.from("colaboradores").select("nome").eq("id", sol.solicitante_id).maybeSingle();
    const solicitante = quem?.nome ?? "—";
    const tipoLabel = TIPO_LABEL[sol.tipo] ?? sol.tipo;
    const acao = ehExecucao ? "Execução" : "Aprovação";
    const subject = `Solicitação ${tipoLabel}${sol.numero != null ? ` #${sol.numero}` : ""} - Aguardando sua ${acao}`;

    if (dry_run) {
      return json({ would_send: true, to: destinatarios.map((d) => d.email), tipo_etapa: etapa.tipo_etapa, subject });
    }

    const appUrl = (Deno.env.get("PORTAL_URL") ?? "https://portal.phdengenharia.tech").replace(/\/+$/, "");
    const logo = Deno.env.get("LOGO_URL") ?? "https://bogsuuhrgvopzgcceoqz.supabase.co/storage/v1/object/public/public-assets/logo_phd.png";

    const tenant = Deno.env.get("GRAPH_TENANT_ID");
    const clientId = Deno.env.get("GRAPH_CLIENT_ID");
    const secret = Deno.env.get("GRAPH_CLIENT_SECRET");
    const sender = Deno.env.get("GRAPH_SENDER") ?? "sistema@phdengenharia.eng.br";
    if (!tenant || !clientId || !secret) return json({ error: "graph_not_configured" }, 500);

    let token: string;
    try {
      token = await graphToken(tenant, clientId, secret);
    } catch (e) {
      console.error("[notify-financeiro-aprovador] graph token:", e);
      return json({ error: `graph_error: ${(e as Error)?.message ?? String(e)}` }, 502);
    }

    // Um e-mail personalizado por destinatário; falha de um não derruba os outros.
    const enviados: string[] = [];
    const falhas: { email: string; erro: string }[] = [];
    for (const dest of destinatarios) {
      const html = montarHtml({ dest, ehExecucao, tipoLabel, numero: sol.numero, solicitante, sol, appUrl, logo });
      try {
        const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ message: { subject, body: { contentType: "HTML", content: html }, toRecipients: [{ emailAddress: { address: dest.email } }] }, saveToSentItems: true }),
        });
        if (res.status !== 202) {
          const t = await res.text();
          console.error("[notify-financeiro-aprovador] graph sendMail:", res.status, t);
          falhas.push({ email: dest.email, erro: `${res.status} ${t.slice(0, 200)}` });
        } else {
          enviados.push(dest.email);
        }
      } catch (e) {
        console.error("[notify-financeiro-aprovador] graph:", e);
        falhas.push({ email: dest.email, erro: (e as Error)?.message ?? String(e) });
      }
    }

    if (enviados.length === 0) return json({ error: "graph_send_failed", falhas }, 502);
    return json({ sent: true, to: enviados, falhas, tipo_etapa: etapa.tipo_etapa });
  } catch (e) {
    console.error("[notify-financeiro-aprovador] erro inesperado:", e);
    return json({ error: `unhandled: ${(e as Error)?.message ?? String(e)}` }, 500);
  }
});
