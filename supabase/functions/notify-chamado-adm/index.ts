// Avisa por e-mail sobre um chamado do módulo ADMINISTRATIVO.
//
//   'aprovacao' -> avisa o APROVADOR DA VEZ que há chamado esperando decisão
//   'decidido'  -> avisa o SOLICITANTE do resultado (aprovado ou reprovado)
//   'mensagem'  -> avisa o OUTRO LADO que há resposta nova
//   'fechado'   -> avisa o SOLICITANTE e convida a avaliar
//
// Mesmo padrão das outras notificações do portal (Microsoft Graph sendMail com
// os secrets GRAPH_* já configurados no projeto).
//
// Só as PARTES são avisadas — nunca o time do Adm inteiro.
//
// Body: { chamado_id, evento, dry_run? } — dry_run responde quem receberia,
// sem enviar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

const EVENTOS = ["aprovacao", "decidido", "mensagem", "fechado"] as const;
type Evento = (typeof EVENTOS)[number];

const escapeHtml = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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
  aviso?: string | null; alerta?: string | null; botao: string; url: string; logo: string;
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
            <td bgcolor="#26405d" style="background:#26405d;border:1px solid rgba(255,255,255,.35);color:#fff;font-weight:800;font-size:12px;border-radius:8px;padding:7px 9px">ADM</td>
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
      <tr><td style="padding:0 26px 28px"><a href="${url}" style="background:#26405d;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px;display:inline-block">${botao}</a></td></tr>
      <tr><td style="padding:14px 26px;border-top:1px solid #e3e3e3;color:#6b7280;font-size:12px">Portal PHD · Administrativo — e-mail automático, não responda.</td></tr>
    </table>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    let chamado_id: string | null = null;
    let evento: Evento = "aprovacao";
    let dry_run = false;
    try {
      ({ chamado_id, evento = "aprovacao", dry_run = false } = await req.json());
    } catch {
      return json({ error: "invalid_body" }, 400);
    }
    if (!chamado_id) return json({ error: "missing_chamado_id" }, 400);
    if (!EVENTOS.includes(evento)) return json({ error: "invalid_evento" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    const { data: ch, error: eCh } = await supabase
      .from("chamados_adm")
      .select("id, numero, assunto, classe, servico, status, descricao, resolucao, solicitante_id, atendente_id, criado_em, sla_vence_em")
      .eq("id", chamado_id)
      .maybeSingle();
    if (eCh) return json({ error: eCh.message }, 500);
    if (!ch) return json({ skipped: "not_found" });

    // Aprovador da vez = menor ordem ainda pendente. Avisar todos de uma cadeia
    // faria o segundo receber e-mail de algo que ainda não é a vez dele.
    let aprovadorId: string | null = null;
    if (evento === "aprovacao") {
      const { data: etapas } = await supabase
        .from("chamados_adm_etapas")
        .select("aprovador_id, ordem")
        .eq("chamado_id", chamado_id)
        .eq("status", "pendente")
        .order("ordem", { ascending: true })
        .limit(1);
      aprovadorId = etapas?.[0]?.aprovador_id ?? null;
      if (!aprovadorId) return json({ skipped: "sem_etapa_pendente" });
    }

    const ids = [ch.solicitante_id, ch.atendente_id, aprovadorId].filter(Boolean) as string[];
    const { data: pessoas, error: ePessoas } = await supabase
      .from("colaboradores").select("id, nome, email").in("id", ids);
    if (ePessoas) return json({ error: ePessoas.message }, 500);
    const acha = (id: string | null) => (id ? pessoas?.find((p) => p.id === id) ?? null : null);
    const solicitante = acha(ch.solicitante_id);
    const atendente = acha(ch.atendente_id);
    const aprovador = acha(aprovadorId);

    const appUrl = (Deno.env.get("PORTAL_URL") ?? "https://portal.phdengenharia.tech").replace(/\/+$/, "");
    const logo = Deno.env.get("LOGO_URL") ?? "https://bogsuuhrgvopzgcceoqz.supabase.co/storage/v1/object/public/public-assets/logo_phd.png";
    const numero = ch.numero != null ? `#${ch.numero}` : "";
    const urlChamado = `${appUrl}/#/administrativo/chamado/${ch.id}`;

    const base: Array<[string, unknown]> = [
      ["Chamado", `${numero} — ${ch.assunto}`],
      ["Solicitante", solicitante?.nome],
      ["Técnico", atendente?.nome],
      ["Aberto em", dataHoraBr(ch.criado_em)],
    ];

    let dest: { nome: string; email: string | null } | null = null;
    let subject = "";
    let html = "";

    if (evento === "aprovacao") {
      dest = aprovador ? { nome: aprovador.nome, email: aprovador.email } : null;
      if (!dest?.email) return json({ skipped: "approver_without_email" });
      subject = `Chamado ${numero} aguarda sua aprovação – ${ch.assunto}`;
      html = montarHtml({
        destNome: dest.nome,
        chamada: `O chamado ${numero} aberto por <strong>${escapeHtml(solicitante?.nome ?? "")}</strong> depende da sua liberação.`,
        linhas: [...base, ["Descrição", ch.descricao]],
        aviso: "O prazo de atendimento só começa a contar depois da sua aprovação.",
        botao: "Aprovar no Portal PHD",
        url: `${appUrl}/#/administrativo/aprovacoes`,
        logo,
      });
    } else if (evento === "decidido") {
      dest = solicitante ? { nome: solicitante.nome, email: solicitante.email } : null;
      if (!dest?.email) return json({ skipped: "requester_without_email" });
      const reprovado = ch.status === "reprovado";
      subject = reprovado
        ? `Seu chamado ${numero} foi reprovado`
        : `Seu chamado ${numero} foi aprovado e está na fila`;
      // Motivo da reprovação vem da etapa: é o que o solicitante precisa ler.
      const { data: etapaReprovada } = reprovado
        ? await supabase.from("chamados_adm_etapas").select("justificativa")
            .eq("chamado_id", chamado_id).eq("status", "reprovada")
            .order("ordem", { ascending: false }).limit(1)
        : { data: null };
      html = montarHtml({
        destNome: dest.nome,
        chamada: reprovado
          ? `Seu chamado ${numero} foi <strong>reprovado</strong>.`
          : `Seu chamado ${numero} foi <strong>aprovado</strong> e seguiu para o Administrativo.`,
        linhas: [...base, ["Vencimento do prazo", dataHoraBr(ch.sla_vence_em)]],
        alerta: etapaReprovada?.[0]?.justificativa
          ? `<strong>Motivo:</strong><br>${escapeHtml(etapaReprovada[0].justificativa)}`
          : null,
        botao: "Ver no Portal PHD",
        url: urlChamado,
        logo,
      });
    } else if (evento === "mensagem") {
      // Quem recebe é o outro lado. Sem técnico definido, não há para quem
      // mandar do lado do Adm — melhor não enviar do que enviar para o vazio.
      const { data: ultima } = await supabase
        .from("chamados_adm_interacoes")
        .select("autor_id, mensagem, interna")
        .eq("chamado_id", chamado_id)
        .order("created_at", { ascending: false })
        .limit(1);
      const msg = ultima?.[0];
      if (!msg) return json({ skipped: "sem_mensagem" });
      // Nota interna é conversa do Adm: o solicitante não pode ser avisado dela.
      if (msg.interna) return json({ skipped: "nota_interna" });

      const paraSolicitante = msg.autor_id !== ch.solicitante_id;
      dest = paraSolicitante
        ? (solicitante ? { nome: solicitante.nome, email: solicitante.email } : null)
        : (atendente ? { nome: atendente.nome, email: atendente.email } : null);
      if (!dest?.email) return json({ skipped: "destinatario_sem_email" });
      const autor = acha(msg.autor_id);
      subject = `Nova mensagem no chamado ${numero}`;
      html = montarHtml({
        destNome: dest.nome,
        chamada: `<strong>${escapeHtml(autor?.nome ?? "Alguém")}</strong> respondeu no chamado ${numero}.`,
        linhas: [...base, ["Mensagem", msg.mensagem]],
        botao: "Responder no Portal PHD",
        url: urlChamado,
        logo,
      });
    } else {
      dest = solicitante ? { nome: solicitante.nome, email: solicitante.email } : null;
      if (!dest?.email) return json({ skipped: "requester_without_email" });
      subject = `Chamado ${numero} foi concluído – avalie o atendimento`;
      html = montarHtml({
        destNome: dest.nome,
        chamada: `O chamado ${numero} foi <strong>concluído</strong>.`,
        linhas: [...base, ["Resolução", ch.resolucao]],
        aviso:
          "Avalie o atendimento no portal. Enquanto a avaliação não for feita, você não consegue abrir novos chamados.",
        botao: "Avaliar no Portal PHD",
        url: urlChamado,
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
        console.error("[notify-chamado-adm] graph sendMail:", sendRes.status, t);
        return json({ error: `graph_send_failed: ${sendRes.status} ${t.slice(0, 400)}` }, 502);
      }
    } catch (e) {
      console.error("[notify-chamado-adm] graph:", e);
      return json({ error: `graph_error: ${(e as Error)?.message ?? String(e)}` }, 502);
    }

    return json({ sent: true, to: dest.email, evento });
  } catch (e) {
    console.error("[notify-chamado-adm] erro inesperado:", e);
    return json({ error: `unhandled: ${(e as Error)?.message ?? String(e)}` }, 500);
  }
});
