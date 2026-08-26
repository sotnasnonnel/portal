// Avisa por e-mail sobre os PROGRAMAS internos (Campo de Ideias e Alavanca PHD).
//
//   'ideia_nova'       -> toda a empresa: alguém registrou ideia ou iniciativa
//   'ideia_status'     -> toda a empresa: a situação de uma iniciativa mudou
//   'alavanca_retorno' -> quem indicou: resultado da avaliação da indicação
//
// Mesmo padrão das outras notificações do portal (Microsoft Graph sendMail com
// os secrets GRAPH_* já configurados no projeto).
//
// Os dois eventos do Campo de Ideias são DIVULGAÇÃO, e é por isso que a lista
// de destinatários é montada aqui e não no navegador: mandá-la do cliente
// exporia o quadro de colaboradores no bundle. Vão em Cco (bccRecipients) —
// uma lista de 150 endereços no "Para" é vazamento de contatos e convite a
// "responder a todos".
//
// Body: { evento, ideia_id?, indicacao_id?, de?, para?, dry_run? }
// dry_run responde quantos receberiam, sem enviar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

const EVENTOS = ["ideia_nova", "ideia_status", "alavanca_retorno"] as const;
type Evento = (typeof EVENTOS)[number];

const escapeHtml = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const SITUACAO: Record<string, string> = {
  idealizado: "Idealizado",
  iniciado: "Iniciado",
  desenvolvimento: "Em desenvolvimento",
  concluido: "Concluído",
};
const CATEGORIA: Record<string, string> = {
  individual: "Uso em atuação individual",
  coletiva: "Uso em atuação coletiva",
  venda: "Venda de produto",
};
const STATUS_ALAVANCA: Record<string, string> = {
  em_analise: "Em análise",
  nao_elegivel: "Não elegível",
  em_evolucao: "Em evolução",
  concluida: "Concluída",
};
const ELEGIBILIDADE: Record<string, string> = {
  pendente: "Verificação pendente",
  em_analise: "Depende do comercial",
  elegivel: "Elegível",
  nao_elegivel: "Não elegível",
};

const dinheiro = (n: unknown) =>
  (n == null ? null : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));

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
  saudacao: string; chamada: string; linhas: Array<[string, unknown]>;
  aviso?: string | null; alerta?: string | null; botao: string; url: string; logo: string;
}) {
  const { saudacao, chamada, linhas, aviso, alerta, botao, url, logo } = opts;
  const linha = (rot: string, val: unknown) =>
    val
      ? `<tr><td style="color:#6b7280;padding:2px 14px 2px 0;vertical-align:top">${rot}</td><td style="color:#1b2735">${escapeHtml(String(val))}</td></tr>`
      : "";
  return `
  <div style="background:#f2f2f2;padding:24px 0;font-family:Inter,Segoe UI,Arial,sans-serif">
    <table role="presentation" align="center" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:92%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,.08)">
      <tr><td bgcolor="#b4522a" style="background:#b4522a;padding:18px 22px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td bgcolor="#b4522a" style="background:#b4522a;border:1px solid rgba(255,255,255,.35);color:#fff;font-weight:800;font-size:12px;border-radius:8px;padding:7px 9px">PROG</td>
            <td style="padding-left:10px;color:#fff;font-size:18px;font-weight:800;letter-spacing:.3px">PHD <span style="color:#ffd9c7">Portal</span></td>
          </tr></table></td>
          <td align="right" style="vertical-align:middle"><img src="${logo}" alt="PHD Engenharia" height="22" style="height:22px;opacity:.95"></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:26px 26px 8px;color:#1b2735;font-size:15px;line-height:1.55">
        <p style="margin:0 0 10px">${saudacao}</p>
        <p style="margin:0 0 16px">${chamada}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;margin-bottom:18px">
          ${linhas.map(([rot, val]) => linha(rot, val)).join("")}
        </table>
        ${alerta ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:18px"><tr><td style="background:#fdecea;border:1px solid #f5c2bc;border-radius:10px;padding:12px 14px;color:#a12a1c;font-size:14px">${alerta}</td></tr></table>` : ""}
        ${aviso ? `<p style="margin:0 0 12px;color:#6b7280;font-size:13px">${aviso}</p>` : ""}
      </td></tr>
      <tr><td style="padding:0 26px 28px"><a href="${url}" style="background:#b4522a;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px;display:inline-block">${botao}</a></td></tr>
      <tr><td style="padding:14px 26px;border-top:1px solid #e3e3e3;color:#6b7280;font-size:12px">Portal PHD · Programas — e-mail automático, não responda.</td></tr>
    </table>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    let evento: Evento = "ideia_nova";
    let ideia_id: string | null = null;
    let indicacao_id: string | null = null;
    let de: string | null = null;
    let para: string | null = null;
    let dry_run = false;
    try {
      ({ evento = "ideia_nova", ideia_id = null, indicacao_id = null, de = null, para = null, dry_run = false } = await req.json());
    } catch {
      return json({ error: "invalid_body" }, 400);
    }
    if (!EVENTOS.includes(evento)) return json({ error: "invalid_evento" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const appUrl = (Deno.env.get("PORTAL_URL") ?? "https://portal.phdengenharia.tech").replace(/\/+$/, "");
    const logo = Deno.env.get("LOGO_URL") ?? "https://bogsuuhrgvopzgcceoqz.supabase.co/storage/v1/object/public/public-assets/logo_phd.png";

    let subject = "";
    let html = "";
    let destinatarios: string[] = [];
    // Divulgação vai em Cco; retorno pessoal vai no Para. A distinção importa:
    // o segundo é uma conversa com uma pessoa, o primeiro é um informe.
    let emCopiaOculta = false;

    if (evento === "ideia_nova" || evento === "ideia_status") {
      if (!ideia_id) return json({ error: "missing_ideia_id" }, 400);
      const { data: ideia, error } = await supabase
        .from("programas_ideias")
        .select("id, numero, tipo, titulo, categoria, situacao, setor, retorno, descricao, finalidade, autor_id")
        .eq("id", ideia_id)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!ideia) return json({ skipped: "not_found" });

      const { data: autor } = await supabase
        .from("colaboradores").select("nome").eq("id", ideia.autor_id).maybeSingle();

      // Toda a empresa: só quem está ativo e já tem e-mail. Ninguém é avisado
      // por ter logado — o cadastro é o critério, como no resto do portal.
      const { data: todos, error: eTodos } = await supabase
        .from("colaboradores").select("email").eq("ativo", true).not("email", "is", null);
      if (eTodos) return json({ error: eTodos.message }, 500);
      destinatarios = [...new Set((todos ?? []).map((c) => (c.email ?? "").trim()).filter(Boolean))];
      emCopiaOculta = true;

      const forma = ideia.tipo === "ideia" ? "ideia" : "iniciativa";
      const base: Array<[string, unknown]> = [
        [forma === "ideia" ? "Ideia" : "Iniciativa", `#${ideia.numero} — ${ideia.titulo}`],
        ["De", autor?.nome],
        ["Setor", ideia.setor],
        ["Tipo", CATEGORIA[ideia.categoria] ?? ideia.categoria],
      ];

      if (evento === "ideia_nova") {
        subject = `Campo de Ideias: nova ${forma} — ${ideia.titulo}`;
        html = montarHtml({
          saudacao: "Olá!",
          chamada: `<strong>${escapeHtml(autor?.nome ?? "Alguém")}</strong> registrou uma nova ${forma} no Campo de Ideias.`,
          linhas: [
            ...base,
            ["Descrição", ideia.descricao ?? ideia.finalidade],
            ["Retorno esperado", ideia.retorno],
          ],
          aviso: "Tem uma ideia ou já está construindo algo? Registre no portal — o Campo de Ideias é aberto a todos.",
          botao: "Ver no Portal PHD",
          url: `${appUrl}/#/programas/ideias`,
          logo,
        });
      } else {
        subject = `Campo de Ideias: ${ideia.titulo} agora está "${SITUACAO[ideia.situacao] ?? ideia.situacao}"`;
        html = montarHtml({
          saudacao: "Olá!",
          chamada: `A ${forma} <strong>${escapeHtml(ideia.titulo)}</strong> mudou de situação no Campo de Ideias.`,
          linhas: [
            ...base,
            ["Situação anterior", de ? (SITUACAO[de] ?? de) : null],
            ["Situação atual", SITUACAO[para ?? ideia.situacao] ?? (para ?? ideia.situacao)],
          ],
          botao: "Ver no Portal PHD",
          url: `${appUrl}/#/programas/ideias`,
          logo,
        });
      }
    } else {
      if (!indicacao_id) return json({ error: "missing_indicacao_id" }, 400);
      const { data: ind, error } = await supabase
        .from("programas_alavanca")
        .select("id, numero, oportunidade, empresa, status, elegibilidade, elegibilidade_motivo, comentario, valor_premio, pago_em, indicado_por")
        .eq("id", indicacao_id)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!ind) return json({ skipped: "not_found" });

      const { data: quem } = await supabase
        .from("colaboradores").select("nome, email").eq("id", ind.indicado_por).maybeSingle();
      if (!quem?.email) return json({ skipped: "indicador_sem_email" });
      destinatarios = [quem.email];

      const concluida = ind.status === "concluida";
      subject = concluida
        ? `Alavanca PHD: sua indicação #${ind.numero} foi concluída 🎉`
        : `Alavanca PHD: retorno sobre a sua indicação #${ind.numero}`;
      html = montarHtml({
        saudacao: `Olá, <strong>${escapeHtml((quem.nome ?? "").split(" ")[0])}</strong>.`,
        chamada: concluida
          ? `A indicação <strong>${escapeHtml(ind.oportunidade)}</strong> foi <strong>concluída</strong> — o contrato foi fechado.`
          : `Há novidade na sua indicação <strong>${escapeHtml(ind.oportunidade)}</strong>.`,
        linhas: [
          ["Indicação", `#${ind.numero} — ${ind.oportunidade}`],
          ["Empresa", ind.empresa],
          ["Elegibilidade", ELEGIBILIDADE[ind.elegibilidade] ?? ind.elegibilidade],
          ["Situação", STATUS_ALAVANCA[ind.status] ?? ind.status],
          ["Comentário do comercial", ind.comentario],
          ["Premiação", concluida ? dinheiro(ind.valor_premio) : null],
          ["Pagamento", ind.pago_em],
        ],
        // O motivo da recusa é o que responde "por quê?" — sem ele, o e-mail
        // seria só uma negativa.
        alerta: ind.elegibilidade === "nao_elegivel" && ind.elegibilidade_motivo
          ? `<strong>Motivo:</strong><br>${escapeHtml(ind.elegibilidade_motivo)}`
          : null,
        aviso: concluida
          ? "O pagamento se dá após o faturamento da primeira medição do contrato."
          : null,
        botao: "Ver no Portal PHD",
        url: `${appUrl}/#/programas/alavanca`,
        logo,
      });
    }

    if (!destinatarios.length) return json({ skipped: "sem_destinatarios" });
    if (dry_run) return json({ would_send: true, total: destinatarios.length, subject });

    const tenant = Deno.env.get("GRAPH_TENANT_ID");
    const clientId = Deno.env.get("GRAPH_CLIENT_ID");
    const secret = Deno.env.get("GRAPH_CLIENT_SECRET");
    const sender = Deno.env.get("GRAPH_SENDER") ?? "sistema@phdengenharia.eng.br";
    if (!tenant || !clientId || !secret) return json({ error: "graph_not_configured" }, 500);

    try {
      const token = await graphToken(tenant, clientId, secret);
      const enderecos = destinatarios.map((address) => ({ emailAddress: { address } }));
      const sendRes = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            subject,
            body: { contentType: "HTML", content: html },
            // Na divulgação o remetente é o próprio "Para": sem ninguém no
            // campo, alguns clientes marcam a mensagem como suspeita.
            toRecipients: emCopiaOculta ? [{ emailAddress: { address: sender } }] : enderecos,
            bccRecipients: emCopiaOculta ? enderecos : [],
          },
          saveToSentItems: true,
        }),
      });
      if (sendRes.status !== 202) {
        const t = await sendRes.text();
        console.error("[notify-programa] graph sendMail:", sendRes.status, t);
        return json({ error: `graph_send_failed: ${sendRes.status} ${t.slice(0, 400)}` }, 502);
      }
    } catch (e) {
      console.error("[notify-programa] graph:", e);
      return json({ error: `graph_error: ${(e as Error)?.message ?? String(e)}` }, 502);
    }

    return json({ sent: true, total: destinatarios.length });
  } catch (e) {
    console.error("[notify-programa]", e);
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});
