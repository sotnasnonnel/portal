// Avisa por e-mail sobre um pedido de AUSÊNCIA PROGRAMADA ou de FOLGA DE CAMPO
// (Gestão de Pessoas).
//   evento 'nova'     -> avisa o GESTOR (aprovador) que há um pedido pendente;
//   evento 'decidida' -> avisa o COLABORADOR do resultado (com o motivo, quando
//                        reprovado).
// Mesmo padrão das outras notificações do portal (Microsoft Graph sendMail com
// os secrets GRAPH_* já configurados no projeto).
//
// UMA função para os DOIS módulos, como no front: ausência e folga de campo são
// a mesma rotina em tabelas separadas (ver src/config/modulosAusencia.js). O
// `modulo` do body escolhe a tabela, a rota e o nome que aparece no texto —
// duas funções seriam duas cópias do mesmo HTML para divergirem na primeira
// correção.
//
// O sino continua avisando de tudo (gatilho trg_notif_ausencia). O e-mail cobre
// só os dois momentos em que alguém precisa AGIR ou saber o desfecho; o alerta
// de saldo vencendo fica fora de propósito, porque roda em lote ao abrir a tela
// e viraria dezenas de e-mails de uma vez.
//
// Body: { solicitacao_id, modulo?, evento?, dry_run? } — dry_run responde quem
// receberia, sem enviar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// Espelha src/config/modulosAusencia.js. A chave que o front manda é a `chave`
// do descritor de lá.
const MODULOS: Record<string, { tabela: string; nome: string; artigo: string; rotaMinha: string; rotaAprovacoes: string }> = {
  ausencia: {
    tabela: "ausencia_solicitacoes",
    nome: "ausência programada",
    artigo: "A",
    rotaMinha: "/ausencia-programada",
    rotaAprovacoes: "/ausencia-programada/aprovacoes",
  },
  folgaCampo: {
    tabela: "folga_campo_solicitacoes",
    nome: "folga de campo",
    artigo: "A",
    rotaMinha: "/folga-de-campo",
    rotaAprovacoes: "/folga-de-campo/aprovacoes",
  },
};

const escapeHtml = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const dataBr = (d: unknown) => {
  if (!d) return null;
  const p = String(d).slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(d);
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

function montarHtml(opts: {
  destNome: string;
  chamada: string;
  linhas: Array<[string, unknown]>;
  aviso?: string | null;
  alerta?: string | null;
  botao: string;
  url: string;
  logo: string;
}) {
  const { destNome, chamada, linhas, aviso, alerta, botao, url, logo } = opts;
  const linha = (rot: string, val: unknown) =>
    val
      ? `<tr><td style="color:#6b7280;padding:2px 14px 2px 0">${rot}</td><td style="color:#1b2735">${escapeHtml(String(val))}</td></tr>`
      : "";
  return `
  <div style="background:#f2f2f2;padding:24px 0;font-family:Inter,Segoe UI,Arial,sans-serif">
    <table role="presentation" align="center" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:92%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,.08)">
      <tr><td bgcolor="#26405d" style="background:#26405d;padding:18px 22px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td bgcolor="#0f766e" style="background:#0f766e;color:#fff;font-weight:800;font-size:12px;border-radius:8px;padding:7px 9px">GP</td>
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
        ${alerta ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:18px"><tr><td style="background:#fdecea;border:1px solid #f5c2bc;border-radius:10px;padding:12px 14px;color:#a12a1c;font-size:14px">${alerta}</td></tr></table>` : ""}
        ${aviso ? `<p style="margin:0 0 12px;color:#6b7280;font-size:13px">${aviso}</p>` : ""}
      </td></tr>
      <tr><td style="padding:0 26px 28px"><a href="${url}" style="background:#0f766e;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px;display:inline-block">${botao}</a></td></tr>
      <tr><td style="padding:14px 26px;border-top:1px solid #e3e3e3;color:#6b7280;font-size:12px">Portal PHD · Gestão de Pessoas — e-mail automático, não responda.</td></tr>
    </table>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    let solicitacao_id: string | null = null;
    let modulo = "ausencia";
    let evento = "nova";
    let dry_run = false;
    try {
      ({ solicitacao_id, modulo = "ausencia", evento = "nova", dry_run = false } = await req.json());
    } catch {
      return json({ error: "invalid_body" }, 400);
    }
    if (!solicitacao_id) return json({ error: "missing_solicitacao_id" }, 400);
    const mod = MODULOS[modulo];
    if (!mod) return json({ error: "invalid_modulo" }, 400);
    if (evento !== "nova" && evento !== "decidida") return json({ error: "invalid_evento" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    const { data: sol, error: eSol } = await supabase
      .from(mod.tabela)
      .select(
        "id, numero, status, colaborador_id, aprovador_id, data_inicio, data_fim, dias, observacao, fora_do_prazo, motivo_reprovacao, decidido_por"
      )
      .eq("id", solicitacao_id)
      .maybeSingle();
    if (eSol) return json({ error: eSol.message }, 500);
    if (!sol) return json({ skipped: "not_found" });

    // O estado no banco é a verdade: um pedido que já foi decidido (ou nem foi
    // enviado) não pode gerar "aguarda sua aprovação" por causa de um clique
    // repetido na tela.
    if (evento === "nova" && sol.status !== "pendente") return json({ skipped: "not_pending" });
    if (evento === "decidida" && !["aprovada", "reprovada"].includes(sol.status)) {
      return json({ skipped: "not_decided" });
    }

    const ids = [sol.colaborador_id, sol.aprovador_id, sol.decidido_por].filter(Boolean) as string[];
    const { data: pessoas, error: ePessoas } = await supabase
      .from("colaboradores")
      .select("id, nome, email")
      .in("id", ids);
    if (ePessoas) return json({ error: ePessoas.message }, 500);
    const colaborador = pessoas?.find((p) => p.id === sol.colaborador_id) ?? null;
    const aprovador = pessoas?.find((p) => p.id === sol.aprovador_id) ?? null;
    const decidiu = pessoas?.find((p) => p.id === sol.decidido_por) ?? null;

    const appUrl = (Deno.env.get("PORTAL_URL") ?? "https://portal.phdengenharia.tech").replace(/\/+$/, "");
    const logo = Deno.env.get("LOGO_URL") ?? "https://bogsuuhrgvopzgcceoqz.supabase.co/storage/v1/object/public/public-assets/logo_phd.png";
    const numero = sol.numero != null ? `#${sol.numero}` : "";
    const periodo = `${dataBr(sol.data_inicio)} a ${dataBr(sol.data_fim)}`;

    let dest: { nome: string; email: string | null } | null;
    let subject: string;
    let html: string;

    if (evento === "nova") {
      dest = aprovador ? { nome: aprovador.nome, email: aprovador.email } : null;
      if (!dest?.email) return json({ skipped: "approver_without_email" });
      subject = `${mod.artigo} ${mod.nome} ${numero} de ${colaborador?.nome ?? ""} aguarda sua aprovação`.replace(/\s+/g, " ").trim();
      html = montarHtml({
        destNome: dest.nome,
        chamada: `Existe um pedido de <strong>${mod.nome}</strong> ${numero} pendente da sua aprovação.`,
        linhas: [
          ["Colaborador", colaborador?.nome],
          ["Período", periodo],
          ["Dias", sol.dias],
          ["Observação", sol.observacao],
        ],
        // O "fora do prazo" é o que muda a decisão: o pedido passa da data
        // limite do período, e aprovar assim custa saldo que vence.
        alerta: sol.fora_do_prazo
          ? "<strong>Fora do prazo:</strong> o período pedido ultrapassa a data limite do saldo."
          : null,
        botao: "Aprovar no Portal PHD",
        url: `${appUrl}/#${mod.rotaAprovacoes}`,
        logo,
      });
    } else {
      dest = colaborador ? { nome: colaborador.nome, email: colaborador.email } : null;
      if (!dest?.email) return json({ skipped: "requester_without_email" });
      const aprovada = sol.status === "aprovada";
      subject = `Sua ${mod.nome} ${numero} foi ${aprovada ? "aprovada" : "reprovada"}`.replace(/\s+/g, " ").trim();
      html = montarHtml({
        destNome: dest.nome,
        chamada: `Seu pedido de <strong>${mod.nome}</strong> ${numero} foi <strong>${aprovada ? "aprovado" : "reprovado"}</strong>.`,
        linhas: [
          ["Período", periodo],
          ["Dias", sol.dias],
          ["Decidido por", decidiu?.nome ?? aprovador?.nome],
        ],
        alerta:
          !aprovada && sol.motivo_reprovacao
            ? `<strong>Motivo:</strong><br>${escapeHtml(sol.motivo_reprovacao)}`
            : null,
        botao: "Ver no Portal PHD",
        url: `${appUrl}/#${mod.rotaMinha}`,
        logo,
      });
    }

    if (dry_run) return json({ would_send: true, to: dest.email, nome: dest.nome, subject });

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
            toRecipients: [{ emailAddress: { address: dest.email } }],
          },
          saveToSentItems: true,
        }),
      });
      if (sendRes.status !== 202) {
        const t = await sendRes.text();
        console.error("[notify-ausencia] graph sendMail:", sendRes.status, t);
        return json({ error: `graph_send_failed: ${sendRes.status} ${t.slice(0, 400)}` }, 502);
      }
    } catch (e) {
      console.error("[notify-ausencia] graph:", e);
      return json({ error: `graph_error: ${(e as Error)?.message ?? String(e)}` }, 502);
    }

    return json({ sent: true, to: dest.email, modulo, evento });
  } catch (e) {
    console.error("[notify-ausencia] erro inesperado:", e);
    return json({ error: `unhandled: ${(e as Error)?.message ?? String(e)}` }, 500);
  }
});
