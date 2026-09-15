// Envia ao Financeiro o PDF do reembolso aprovado que será COBRADO DO CLIENTE.
//
// Pedido da Alinne: todo reembolso marcado como "reembolsável pelo cliente"
// chega a ela em PDF, para a cobrança — sem depender de alguém lembrar.
//
// Quem gera o PDF é o NAVEGADOR de quem aprova (o mesmo gerador do botão
// "Gerar PDF"), e ele sobe o arquivo no bucket 'reembolso-pdf-cliente'. Esta
// função só confere, anexa e envia — e grava o resultado no registro
// reembolso_envios_cliente, que é a prova de que o e-mail saiu.
//
// NÃO confia no navegador: relê o pedido e só envia se ele estiver de fato
// aprovado, reembolsável e for reembolso (a mesma regra do gatilho do banco).
//
// Body: { id, path, reenviar? }
// Destinatários: secret REEMBOLSO_CLIENTE_EMAILS (separados por vírgula). Fica
// fora do código para trocar férias/substituição sem deploy.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

const BRL = (v: unknown) => Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
// Texto do banco entra em HTML: nome e obra são digitados pelo usuário.
const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const dataBr = (d: unknown) => {
  if (!d) return null;
  const p = String(d).slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(d);
};

// Limite do sendMail do Graph: anexos até ~3 MB na mesma requisição. O base64
// incha o arquivo em 4/3, então o teto aqui é sobre o tamanho BRUTO, com folga.
// Acima disso o anexo vira link — melhor um e-mail com link que um e-mail que
// o Graph recusa inteiro.
const LIMITE_ANEXOS_BYTES = 2_200_000;
const VALIDADE_LINK_SEG = 7 * 24 * 3600;

function paraBase64(bytes: Uint8Array): string {
  // Em blocos: String.fromCharCode(...arrayGrande) estoura a pilha.
  let bin = "";
  const BLOCO = 0x8000;
  for (let i = 0; i < bytes.length; i += BLOCO) bin += String.fromCharCode(...bytes.subarray(i, i + BLOCO));
  return btoa(bin);
}

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

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // Grava o desfecho no registro. Toda saída depois da validação passa por
  // aqui: um envio que termina sem registro é exatamente o furo que o registro
  // existe para fechar.
  const registrar = async (id: string, patch: Record<string, unknown>) => {
    const { data: atual } = await supabase
      .from("reembolso_envios_cliente").select("tentativas").eq("reimbursement_id", id).maybeSingle();
    await supabase.from("reembolso_envios_cliente").upsert({
      reimbursement_id: id,
      tentativas: (atual?.tentativas ?? 0) + 1,
      atualizado_em: new Date().toISOString(),
      ...patch,
    }, { onConflict: "reimbursement_id" });
  };

  let id = "";
  try {
    let path = "";
    let reenviar = false;
    try { ({ id, path, reenviar = false } = await req.json()); } catch { return json({ error: "invalid_body" }, 400); }
    if (!id) return json({ error: "missing_id" }, 400);

    // ---- quem está pedindo ----
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: auth } = await supabase.auth.getUser(jwt);
    const quem = auth?.user?.id;
    if (!quem) return json({ error: "unauthorized" }, 401);

    // ---- o pedido, relido do banco ----
    const { data: r, error } = await supabase
      .from("reembolso_reimbursements")
      .select("id, code, kind, status, billable_to_client, manager_id, requester_name, total, approved_amount, payment_date, decided_at, decided_by_name, client_obra")
      .eq("id", id)
      .maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!r) return json({ skipped: "not_found" });

    // A mesma regra de deveEnviarAoCliente e do gatilho.
    const entra = String(r.status) === "aprovado"
      && (r.kind ?? "reembolso") === "reembolso"
      && r.billable_to_client === true;
    if (!entra) return json({ skipped: "fora_da_regra", motivo: "Este pedido não é um reembolso aprovado cobrado do cliente." });

    // ---- pode pedir? gestor que aprovou, ou admin ----
    const [{ data: perfil }, { data: colab }] = await Promise.all([
      supabase.from("reembolso_profiles").select("role").eq("id", quem).maybeSingle(),
      supabase.from("colaboradores").select("financeiro_role").eq("auth_id", quem).maybeSingle(),
    ]);
    const ehAdmin = perfil?.role === "admin" || colab?.financeiro_role === "admin";
    if (!ehAdmin && r.manager_id !== quem) return json({ error: "forbidden" }, 403);
    // Reenviar o que já saiu é decisão do Financeiro, não de qualquer aprovador.
    if (reenviar && !ehAdmin) return json({ error: "forbidden", motivo: "Só o Financeiro pode reenviar." }, 403);

    const { data: registro } = await supabase
      .from("reembolso_envios_cliente").select("status").eq("reimbursement_id", id).maybeSingle();
    if (registro?.status === "enviado" && !reenviar) return json({ skipped: "ja_enviado" });

    // ---- validações que já contam como tentativa ----
    // O PDF tem de estar na pasta do PRÓPRIO pedido: sem isso, bastava mandar o
    // caminho de outro reembolso para anexar o documento de outra pessoa.
    if (!path || !path.startsWith(`${id}/`) || !path.toLowerCase().endsWith(".pdf")) {
      await registrar(id, { status: "falhou", ultimo_erro: "PDF não recebido do portal." });
      return json({ sent: false, motivo: "PDF não recebido do portal." });
    }

    const destinatarios = (Deno.env.get("REEMBOLSO_CLIENTE_EMAILS") ?? "")
      .split(/[,;]/).map((e) => e.trim()).filter((e) => e.includes("@"));
    if (!destinatarios.length) {
      await registrar(id, { status: "falhou", ultimo_erro: "Destinatário não configurado (REEMBOLSO_CLIENTE_EMAILS)." });
      return json({ sent: false, motivo: "Destinatário do Financeiro não configurado." });
    }

    // ---- o PDF gerado + as notas fiscais que são PDF ----
    // O gerador não consegue embutir nota em PDF (vira uma página de aviso), e
    // para cobrar o cliente é a nota original que importa. Então elas vão como
    // anexos à parte.
    const { data: pdfBlob, error: dlErr } = await supabase.storage.from("reembolso-pdf-cliente").download(path);
    if (dlErr || !pdfBlob) {
      await registrar(id, { status: "falhou", ultimo_erro: `Não foi possível ler o PDF: ${dlErr?.message ?? "vazio"}` });
      return json({ sent: false, motivo: "Não foi possível ler o PDF gerado." });
    }
    const nomePdf = path.slice(path.indexOf("/") + 1);
    const arquivos: Array<{ nome: string; bytes: Uint8Array; bucket: string; caminho: string }> = [
      { nome: nomePdf, bytes: new Uint8Array(await pdfBlob.arrayBuffer()), bucket: "reembolso-pdf-cliente", caminho: path },
    ];

    const { data: notas } = await supabase
      .from("reembolso_nf_images").select("storage_path, nf_number").eq("reimbursement_id", id);
    for (const [i, nf] of (notas ?? []).entries()) {
      if (!String(nf.storage_path ?? "").toLowerCase().endsWith(".pdf")) continue;
      const { data: b } = await supabase.storage.from("reembolso-nf").download(nf.storage_path);
      if (!b) continue;
      arquivos.push({
        nome: `NF ${nf.nf_number || `sem numero ${i + 1}`}.pdf`.replace(/[\\/:*?"<>|]/g, "-"),
        bytes: new Uint8Array(await b.arrayBuffer()),
        bucket: "reembolso-nf",
        caminho: nf.storage_path,
      });
    }

    // Anexa enquanto couber, na ordem (o PDF do reembolso primeiro). O que não
    // couber vai como link com validade de 7 dias.
    const anexos: unknown[] = [];
    const links: Array<{ nome: string; url: string }> = [];
    let usado = 0;
    for (const a of arquivos) {
      if (usado + a.bytes.length <= LIMITE_ANEXOS_BYTES) {
        usado += a.bytes.length;
        anexos.push({
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: a.nome,
          contentType: "application/pdf",
          contentBytes: paraBase64(a.bytes),
        });
      } else {
        const { data: s } = await supabase.storage.from(a.bucket).createSignedUrl(a.caminho, VALIDADE_LINK_SEG);
        if (s?.signedUrl) links.push({ nome: a.nome, url: s.signedUrl });
      }
    }

    // ---- e-mail ----
    const base = (Deno.env.get("PORTAL_URL") ?? "https://portal.phdengenharia.tech").replace(/\/+$/, "");
    const pago = r.approved_amount != null ? Number(r.approved_amount) : Number(r.total ?? 0);
    const linha = (rot: string, val: unknown) =>
      val ? `<tr><td style="color:#6b7280;padding:2px 14px 2px 0">${rot}</td><td style="color:#1b2735">${val}</td></tr>` : "";
    const subject = `Reembolso ${r.code ?? ""} aprovado — cobrar do cliente${r.client_obra ? ` (${r.client_obra})` : ""}`
      .replace(/\s+/g, " ");

    const html = `
  <div style="background:#f2f2f2;padding:24px 0;font-family:Inter,Segoe UI,Arial,sans-serif">
    <table role="presentation" align="center" width="520" cellpadding="0" cellspacing="0" style="width:520px;max-width:92%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,.08)">
      <tr><td bgcolor="#26405d" style="background:#26405d;padding:18px 22px">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td bgcolor="#c35e1e" style="background:#c35e1e;color:#fff;font-weight:800;font-size:13px;border-radius:8px;padding:7px 9px">R$</td>
          <td style="padding-left:10px;color:#fff;font-size:18px;font-weight:800;letter-spacing:.3px">PHD <span style="color:#e8814a">Reembolso</span></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:26px 26px 8px;color:#1b2735;font-size:15px;line-height:1.55">
        <p style="margin:0 0 16px">O reembolso <strong>${esc(r.code)}</strong> foi aprovado e está marcado como
          <strong>reembolsável pelo cliente</strong>. O PDF segue ${anexos.length ? "em anexo" : "no link abaixo"}.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;margin-bottom:18px">
          ${linha("Colaborador", esc(r.requester_name))}
          ${linha("Cliente / Obra", esc(r.client_obra))}
          ${linha("Valor aprovado", `<strong>${BRL(pago)}</strong>`)}
          ${linha("Aprovado em", dataBr(r.decided_at))}
          ${linha("Aprovado por", esc(r.decided_by_name))}
          ${linha("Data de pagamento", dataBr(r.payment_date))}
        </table>
        ${links.length ? `<p style="margin:0 0 8px;font-size:13px;color:#8a6300;background:#fff3d6;border-radius:10px;padding:10px 12px">
          Estes arquivos passaram do limite de anexo e seguem por link, válido por 7 dias:<br>
          ${links.map((l) => `<a href="${l.url}" style="color:#26405d">${esc(l.nome)}</a>`).join("<br>")}</p>` : ""}
      </td></tr>
      <tr><td style="padding:0 26px 28px"><a href="${base}/#/reembolsos/${r.id}" style="background:#c35e1e;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px;display:inline-block">Ver no Portal PHD</a></td></tr>
      <tr><td style="padding:14px 26px;border-top:1px solid #e3e3e3;color:#6b7280;font-size:12px">PHD Reembolso · envio automático para cobrança ao cliente — não responda.</td></tr>
    </table>
  </div>`;

    const tenant = Deno.env.get("GRAPH_TENANT_ID");
    const clientId = Deno.env.get("GRAPH_CLIENT_ID");
    const secret = Deno.env.get("GRAPH_CLIENT_SECRET");
    const sender = Deno.env.get("GRAPH_SENDER") ?? "sistema@phdengenharia.eng.br";
    if (!tenant || !clientId || !secret) {
      await registrar(id, { status: "falhou", ultimo_erro: "Envio de e-mail não configurado (GRAPH_*)." });
      return json({ error: "graph_not_configured" }, 500);
    }

    const token = await graphToken(tenant, clientId, secret);
    const sendRes = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "HTML", content: html },
          toRecipients: destinatarios.map((address) => ({ emailAddress: { address } })),
          attachments: anexos,
        },
        saveToSentItems: true,
      }),
    });
    if (sendRes.status !== 202) {
      const t = await sendRes.text();
      console.error("[envia-reembolso-cliente] graph sendMail:", sendRes.status, t);
      await registrar(id, { status: "falhou", ultimo_erro: `E-mail recusado (${sendRes.status}): ${t.slice(0, 300)}` });
      return json({ sent: false, motivo: "O servidor de e-mail recusou o envio." }, 502);
    }

    await registrar(id, {
      status: "enviado",
      ultimo_erro: links.length ? `Enviado com ${links.length} arquivo(s) por link (acima do limite de anexo).` : null,
      enviado_em: new Date().toISOString(),
      enviado_para: destinatarios.join(", "),
      pdf_path: path,
    });
    return json({ sent: true, to: destinatarios, anexos: anexos.length, links: links.length });
  } catch (e) {
    console.error("[envia-reembolso-cliente] erro inesperado:", e);
    if (id) await registrar(id, { status: "falhou", ultimo_erro: `Erro inesperado: ${(e as Error)?.message ?? String(e)}` }).catch(() => {});
    return json({ error: `unhandled: ${(e as Error)?.message ?? String(e)}` }, 500);
  }
});
