// Envia por e-mail o termo de medição (termo para emissão da NF) do Fechamento PJ.
//
// Um e-mail POR PRESTADOR, sempre: o termo traz valor e descontos de uma pessoa,
// e juntar vários num disparo só mostraria o pagamento de um para o outro.
// Cópia: e-mail do Financeiro (se ligado) e contatos extras da configuração.
// Responder vai para o Financeiro, não para a caixa do sistema.
//
// SEGURANÇA: a função lê e grava com o LOGIN DE QUEM CHAMOU (não com a service
// role). Assim a RLS do módulo — app_private.pode_fechamento_pj() — decide o que
// a pessoa enxerga: quem não tem acesso recebe "nada encontrado" e nenhum
// e-mail sai. O navegador só manda ids; assunto, corpo e destinatários são
// montados aqui a partir do banco, para a função não virar um disparador livre.
//
// Body: { envelope_ids: string[], dry_run?: boolean }
// Resposta: { resultados: [{ envelope_id, status: 'enviado'|'ignorado'|'falhou', motivo? }] }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

const MAX_ENVELOPES = 200;

// Espelho de src/modules/fechamentoPj/app/folha/folhaUtil.js (TOMADOR e ENDERECO_TOMADOR).
const TOMADOR = { razao: "PHD ASSESSORIA EM GESTAO LTDA", cnpj: "45.420.053/0001-08" };
const ENDERECO_TOMADOR = "Av. Raja Gabáglia, 4343 - Santa Lúcia, Belo Horizonte-MG, 30350-577";

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const emailValido = (v: unknown) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v ?? "").trim());
const brl = (v: unknown) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const competenciaRotulo = (iso: unknown) => {
  const m = /^(\d{4})-(\d{2})/.exec(String(iso ?? ""));
  return m ? `${m[2]}/${m[1]}` : "—";
};
const dataBr = (iso: unknown) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
};
const dataHoraBr = (ts: unknown) =>
  ts ? new Date(String(ts)).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }) : "—";
const mascararCnpj = (v: unknown) => {
  const d = String(v ?? "").replace(/\D/g, "");
  if (d.length !== 14) return String(v ?? "");
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
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

type Pessoa = { codigo: string; nome: string; email: string; razaoSocial: string; cnpj: string };

// Mesma regra de pessoaDoEnvelope (folhaUtil.js): o cadastro congelado no
// fechamento vence o cadastro atual.
function pessoaDoEnvelope(env: any, p: any): Pessoa {
  const c = env?.cadastro || null;
  return {
    codigo: c?.codigo || p?.codigo || "—",
    nome: c?.nome || p?.nome || "",
    email: String(c?.email ?? p?.email ?? "").trim(),
    razaoSocial: c?.razaoSocial || p?.razao_social || "",
    cnpj: c?.cnpj || p?.cnpj || "",
  };
}

// Corpo do e-mail = o mesmo termo da tela (DocumentoTermo em Termo.jsx).
function montarHtml(o: {
  pessoa: Pessoa; competencia: string; bruto: number; descontos: number;
  comp: any; emailFinanceiro: string; logo: string;
}) {
  const { pessoa, competencia, bruto, descontos, comp, emailFinanceiro, logo } = o;
  const rot = competenciaRotulo(competencia);
  const liquido = Math.round((bruto - descontos) * 100) / 100;
  const th = 'style="text-align:left;color:#6b7280;font-weight:500;padding:6px 14px 6px 0;border-bottom:1px solid #eef0f3;vertical-align:top"';
  const td = 'style="color:#1b2735;padding:6px 0;border-bottom:1px solid #eef0f3"';
  const linha = (a: string, b: string) => `<tr><th ${th}>${a}</th><td ${td}>${b}</td></tr>`;
  // Só o total compensado. A abertura dos descontos não vai no e-mail do
  // prestador: ela fica no envelope e na folha analítica, como no termo da tela.
  const descontosHtml = descontos > 0
    ? `<p style="margin:16px 0 8px">Já se encontra compensado no valor líquido acima o valor total de <strong>${brl(descontos)}</strong>.</p>`
    : "";
  return `
  <div style="background:#f2f2f2;padding:24px 0;font-family:Inter,Segoe UI,Arial,sans-serif">
    <table role="presentation" align="center" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:94%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,.08)">
      <tr><td bgcolor="#26405d" style="background:#26405d;padding:18px 22px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="color:#fff;font-size:16px;font-weight:800">Competência ${rot}</td>
          <td align="right"><img src="${logo}" alt="PHD" height="22" style="height:22px;opacity:.95"></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:24px 26px;color:#1b2735;font-size:14px;line-height:1.55">
        <h1 style="margin:0 0 16px;font-size:17px;color:#26405d">TERMO DE MEDIÇÃO E AUTORIZAÇÃO DE FATURAMENTO</h1>
        <p style="margin:0 0 12px">À <strong>${esc(pessoa.razaoSocial || pessoa.nome)}</strong><br>
          CNPJ: <strong>${pessoa.cnpj ? esc(mascararCnpj(pessoa.cnpj)) : "não cadastrado"}</strong><br>
          <span style="color:#6b7280">Código ${esc(pessoa.codigo)}</span></p>
        <p style="margin:0 0 16px">Informamos que a medição dos serviços prestados no mês <strong>${rot}</strong> foi concluída.
          Fica autorizada a emissão da Nota Fiscal no valor líquido de <strong>${brl(liquido)}</strong>.</p>
        <h2 style="margin:0 0 6px;font-size:15px;color:#26405d">Dados para emissão da Nota Fiscal</h2>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px">
          ${linha("Tomador do serviço", esc(TOMADOR.razao))}
          ${linha("CNPJ do tomador", esc(TOMADOR.cnpj))}
          ${linha("Endereço", esc(ENDERECO_TOMADOR))}
          ${linha("Descrição do serviço", "Atentar-se para o escopo contratual.")}
          ${linha("Valor bruto", brl(bruto))}
          ${linha("Valor líquido da NF", `<strong>${brl(liquido)}</strong>`)}
        </table>
        ${descontosHtml}
        <p style="margin:16px 0 8px">Consulte a situação do seu pagamento em
          <a href="https://consulta.phdengenharia.tech/" style="color:#26405d">consulta.phdengenharia.tech</a> (informe o CNPJ).</p>
        <p style="margin:0 0 16px">A Nota Fiscal deve ser enviada para <strong>${esc(emailFinanceiro || "o Financeiro")}</strong>.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%"><tr><td style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px 14px">
          <strong style="color:#9a3412">Atenção aos prazos</strong>
          <ul style="margin:6px 0 6px 18px;padding:0">
            <li>Envio dos termos: <strong>${dataBr(comp?.data_envio_termos)}</strong></li>
            <li>Prazo para emissão e envio da NF: <strong>${dataHoraBr(comp?.prazo_nf)}</strong></li>
            <li>Data prevista de pagamento: <strong>${dataBr(comp?.data_pagamento)}</strong></li>
          </ul>
          <span style="font-size:13px;color:#6b7280">Nota Fiscal recebida depois do prazo passa para a data de pagamento seguinte.</span>
        </td></tr></table>
        <p style="margin:20px 0 0">Atenciosamente,<br><strong>${esc(TOMADOR.razao)}</strong><br>
          <span style="color:#e8814a;font-style:italic">Tudo acontece com gente!</span></p>
      </td></tr>
    </table>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const authorization = req.headers.get("Authorization") ?? "";
    if (!authorization.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    let envelope_ids: unknown = null;
    let dry_run = false;
    try {
      ({ envelope_ids, dry_run = false } = await req.json());
    } catch {
      return json({ error: "invalid_body" }, 400);
    }
    const ids = Array.isArray(envelope_ids)
      ? [...new Set(envelope_ids.filter((x) => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)))]
      : [];
    if (!ids.length) return json({ error: "missing_envelope_ids" }, 400);
    if (ids.length > MAX_ENVELOPES) return json({ error: `max_${MAX_ENVELOPES}_envelopes` }, 400);

    // Cliente COM o login de quem chamou: a RLS do módulo vale aqui também.
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authorization } },
    });

    const { data: auth, error: eAuth } = await db.auth.getUser(authorization.slice(7));
    if (eAuth || !auth?.user) return json({ error: "unauthorized" }, 401);
    const { data: eu } = await db.from("colaboradores").select("id").eq("auth_id", auth.user.id).maybeSingle();

    const { data: envelopes, error: eEnv } = await db
      .from("pj_envelopes")
      .select("id, competencia, prestador_id, bruto, descontos, termo, envio, cadastro")
      .in("id", ids);
    if (eEnv) return json({ error: eEnv.message }, 500);
    // Sem acesso ao módulo, a RLS devolve zero linhas.
    if (!envelopes?.length) return json({ error: "forbidden_or_not_found" }, 403);

    const prestIds = [...new Set(envelopes.map((e) => e.prestador_id))];
    const comps = [...new Set(envelopes.map((e) => e.competencia))];
    const [{ data: prestadores, error: eP }, { data: competencias, error: eC }, { data: config, error: eCfg }] = await Promise.all([
      db.from("pj_prestadores").select("id, codigo, nome, email, razao_social, cnpj").in("id", prestIds),
      db.from("pj_competencias").select("competencia, data_envio_termos, prazo_nf, data_pagamento").in("competencia", comps),
      db.from("pj_config").select("email_financeiro, contatos_extras, assunto_email, copia_financeiro").eq("id", 1).maybeSingle(),
    ]);
    if (eP || eC || eCfg) return json({ error: (eP || eC || eCfg)!.message }, 500);

    const emailFin = String(config?.email_financeiro ?? "").trim();
    const copias: string[] = [];
    if (config?.copia_financeiro && emailValido(emailFin)) copias.push(emailFin);
    for (const c of Array.isArray(config?.contatos_extras) ? config.contatos_extras : []) {
      const e = String(c?.email ?? "").trim();
      if (emailValido(e) && !copias.includes(e)) copias.push(e);
    }
    const logo = Deno.env.get("LOGO_URL") ?? "https://bogsuuhrgvopzgcceoqz.supabase.co/storage/v1/object/public/public-assets/logo_phd.png";

    const resultados: Array<{ envelope_id: string; nome?: string; email?: string; status: string; motivo?: string }> = [];
    const envios: Array<{ env: any; pessoa: Pessoa; subject: string; html: string }> = [];

    for (const id of ids) {
      const env = envelopes.find((e) => e.id === id);
      if (!env) { resultados.push({ envelope_id: id, status: "ignorado", motivo: "Envelope não encontrado." }); continue; }
      const pessoa = pessoaDoEnvelope(env, prestadores?.find((p) => p.id === env.prestador_id));
      const base = { envelope_id: id, nome: pessoa.nome, email: pessoa.email };
      if (env.termo !== "gerado") { resultados.push({ ...base, status: "ignorado", motivo: "Termo não gerado." }); continue; }
      if (env.envio === "enviado") { resultados.push({ ...base, status: "ignorado", motivo: "Já enviado." }); continue; }
      if (!emailValido(pessoa.email)) { resultados.push({ ...base, status: "ignorado", motivo: "Sem e-mail válido no cadastro." }); continue; }
      const subject = String(config?.assunto_email || "Termo para emissão da Nota Fiscal — {{competencia}}")
        .replace(/\{\{\s*competencia\s*\}\}/gi, competenciaRotulo(env.competencia));
      const html = montarHtml({
        pessoa, competencia: env.competencia, bruto: Number(env.bruto) || 0, descontos: Number(env.descontos) || 0,
        comp: competencias?.find((c) => c.competencia === env.competencia), emailFinanceiro: emailFin, logo,
      });
      envios.push({ env, pessoa, subject, html });
    }

    if (dry_run) {
      return json({
        dry_run: true,
        cc: copias,
        enviaria: envios.map((x) => ({ envelope_id: x.env.id, nome: x.pessoa.nome, email: x.pessoa.email, subject: x.subject })),
        resultados,
      });
    }
    if (!envios.length) return json({ resultados });

    const tenant = Deno.env.get("GRAPH_TENANT_ID");
    const clientId = Deno.env.get("GRAPH_CLIENT_ID");
    const secret = Deno.env.get("GRAPH_CLIENT_SECRET");
    const sender = Deno.env.get("GRAPH_SENDER") ?? "sistema@phdengenharia.eng.br";
    if (!tenant || !clientId || !secret) return json({ error: "graph_not_configured" }, 500);
    const token = await graphToken(tenant, clientId, secret);

    for (const { env, pessoa, subject, html } of envios) {
      const base = { envelope_id: env.id, nome: pessoa.nome, email: pessoa.email };
      try {
        const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              subject,
              body: { contentType: "HTML", content: html },
              toRecipients: [{ emailAddress: { address: pessoa.email } }],
              ccRecipients: copias.map((address) => ({ emailAddress: { address } })),
              ...(emailValido(emailFin) ? { replyTo: [{ emailAddress: { address: emailFin } }] } : {}),
            },
            saveToSentItems: true,
          }),
        });
        if (res.status !== 202) {
          const t = await res.text();
          console.error("[send-termo-pj] graph sendMail:", res.status, t);
          resultados.push({ ...base, status: "falhou", motivo: `Servidor de e-mail recusou (${res.status}).` });
          continue;
        }
      } catch (e) {
        console.error("[send-termo-pj] graph:", e);
        resultados.push({ ...base, status: "falhou", motivo: (e as Error)?.message ?? String(e) });
        continue;
      }

      // E-mail saiu: marca o envelope. Se a gravação falhar, o e-mail já foi —
      // o resultado diz isso para ninguém reenviar achando que não saiu.
      const { error: eUp } = await db.from("pj_envelopes")
        .update({ envio: "enviado", enviado_em: new Date().toISOString(), enviado_por: eu?.id ?? null })
        .eq("id", env.id).eq("termo", "gerado");
      await db.from("pj_auditoria").insert({
        acao: "Termo enviado por e-mail",
        detalhe: `${pessoa.nome} • ${pessoa.email} • assunto: ${subject} • cópia: ${copias.length ? copias.join(", ") : "sem cópia"}`,
        competencia: env.competencia,
        prestador_id: env.prestador_id,
      });
      resultados.push(eUp
        ? { ...base, status: "enviado", motivo: `E-mail enviado, mas o status não foi gravado: ${eUp.message}` }
        : { ...base, status: "enviado" });
    }

    return json({ resultados });
  } catch (e) {
    console.error("[send-termo-pj] erro inesperado:", e);
    return json({ error: `unhandled: ${(e as Error)?.message ?? String(e)}` }, 500);
  }
});
