// Avisa por e-mail sobre os PROGRAMAS internos (Campo de Ideias e Alavanca PHD).
//
//   'ideia_nova'       -> GERENTES e DIRETORIA: alguém registrou ideia/iniciativa
//   'ideia_status'     -> GERENTES e DIRETORIA: a situação de uma iniciativa mudou
//   'alavanca_nova'    -> DIRETORIA e TIME COMERCIAL: chegou uma indicação nova
//   'alavanca_retorno' -> quem indicou: resultado da avaliação da indicação
//   'iniciativa_pedido_novo'   -> ADMINS do módulo: pediram uma iniciativa para uma obra
//   'iniciativa_pedido_status' -> quem pediu: a Inovação respondeu
//
// Mesmo padrão das outras notificações do portal (Microsoft Graph sendMail com
// os secrets GRAPH_* já configurados no projeto).
//
// Os três primeiros eventos vão para uma LISTA, e é por isso que ela é montada
// aqui e não no navegador: mandá-la do cliente exporia o quadro de
// colaboradores no bundle. Vão em Cco (bccRecipients) — uma lista de dezenas de
// endereços no "Para" é vazamento de contatos e convite a "responder a todos".
//
// Quem é "gerente"/"diretoria" sai da coluna `funcao` (o texto do cargo), e não
// de `perfil`: no portal o perfil não reflete o cargo — diretores e gerentes
// ficam todos como 'gestor'. Mesmo critério de config/financeiroAcesso.js.
//
// Body: { evento, ideia_id?, indicacao_id?, pedido_id?, de?, para?, dry_run? }
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

const EVENTOS = [
  "ideia_nova", "ideia_status", "alavanca_nova", "alavanca_retorno",
  "iniciativa_pedido_novo", "iniciativa_pedido_status",
] as const;
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
  // Ausente aqui, o status cru ("encerrada") vazava para o e-mail de quem
  // indicou. Chamava-se "cancelada" e nem esse estava mapeado.
  encerrada: "Encerrada",
};
const STATUS_PEDIDO: Record<string, string> = {
  recebido: "Recebido",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  implantado: "Implantado",
  recusado: "Recusado",
};
const ELEGIBILIDADE: Record<string, string> = {
  pendente: "Verificação pendente",
  em_analise: "Depende do comercial",
  elegivel: "Elegível",
  nao_elegivel: "Não elegível",
};

const dinheiro = (n: unknown) =>
  (n == null ? null : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));

// Recortada da string, não via new Date(): a coluna é `date` e chega como
// "2026-08-31". Passar por Date a lê como meia-noite UTC e, num fuso negativo,
// o e-mail anunciaria o pagamento para o dia anterior.
const dataBr = (iso: unknown) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
};

// Sem acento e em caixa alta: "Operação" e "OPERACAO" precisam casar.
const semAcento = (s: string) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

const temCargo = (funcao: string | null, cargos: string[]) => {
  const f = semAcento(funcao ?? "");
  return cargos.some((c) => f.includes(c));
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

/**
 * Envio pelo Graph. Virou função porque há dois caminhos que terminam em envio
 * (a indicação nova sai mais cedo, com outra lista de destinatários) — duplicar
 * o bloco garantiria que um dos dois ficasse para trás na primeira correção.
 */
async function enviar(opts: {
  destinatarios: string[]; emCopiaOculta: boolean; subject: string; html: string;
}) {
  const { destinatarios, emCopiaOculta, subject, html } = opts;
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
          // Na lista o remetente e o proprio "Para": sem ninguem no campo,
          // alguns clientes marcam a mensagem como suspeita.
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
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    let evento: Evento = "ideia_nova";
    let ideia_id: string | null = null;
    let indicacao_id: string | null = null;
    let pedido_id: string | null = null;
    let de: string | null = null;
    let para: string | null = null;
    let dry_run = false;
    try {
      ({
        evento = "ideia_nova", ideia_id = null, indicacao_id = null, pedido_id = null,
        de = null, para = null, dry_run = false,
      } = await req.json());
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

      // Gerentes e diretoria. O filtro por cargo é feito aqui, e não no SQL,
      // porque `funcao` é texto livre e acentuado: um ilike '%GERENTE%' deixaria
      // "Gerente" e "GERÊNCIA" de fora conforme quem digitou.
      const { data: todos, error: eTodos } = await supabase
        .from("colaboradores").select("email, funcao")
        .eq("ativo", true).eq("recebe_email_listas", true).not("email", "is", null);
      if (eTodos) return json({ error: eTodos.message }, 500);
      destinatarios = [...new Set(
        (todos ?? [])
          .filter((c) => temCargo(c.funcao, ["DIRETOR", "GERENTE"]))
          .map((c) => (c.email ?? "").trim())
          .filter(Boolean),
      )];
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
          aviso: "Você está recebendo por ser gerente ou diretor. O Campo de Ideias é aberto a todos: qualquer pessoa registra e todo mundo enxerga o painel.",
          botao: "Ver no Portal PHD",
          url: `${appUrl}/#/programas/dashboard`,
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
          url: `${appUrl}/#/programas/dashboard`,
          logo,
        });
      }
    } else if (evento === "alavanca_nova" || evento === "alavanca_retorno") {
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

      if (evento === "alavanca_nova") {
        // Diretoria + time comercial. O comercial vem do papel do módulo
        // (programas_role), não do cargo: quem avalia a Alavanca é quem tem o
        // papel, e nem todo comercial tem "COMERCIAL" escrito na função.
        const { data: todos, error: eTodos } = await supabase
          .from("colaboradores")
          .select("email, funcao, programas_role")
          .eq("ativo", true).eq("recebe_email_listas", true).not("email", "is", null);
        if (eTodos) return json({ error: eTodos.message }, 500);
        destinatarios = [...new Set(
          (todos ?? [])
            .filter((c) => temCargo(c.funcao, ["DIRETOR"])
              || c.programas_role === "comercial" || c.programas_role === "admin")
            .map((c) => (c.email ?? "").trim())
            .filter(Boolean),
        )];
        emCopiaOculta = true;

        subject = `Alavanca PHD: nova indicação #${ind.numero} — ${ind.empresa}`;
        html = montarHtml({
          saudacao: "Olá!",
          chamada: `<strong>${escapeHtml(quem?.nome ?? "Um colaborador")}</strong> indicou uma nova oportunidade no programa Alavanca PHD.`,
          linhas: [
            ["Indicação", `#${ind.numero} — ${ind.oportunidade}`],
            ["Empresa", ind.empresa],
            ["Indicado por", quem?.nome],
            ["Elegibilidade", ELEGIBILIDADE[ind.elegibilidade] ?? ind.elegibilidade],
          ],
          // A checagem automática já respondeu; o que o comercial precisa saber
          // é se sobrou decisão para ele.
          aviso: ind.elegibilidade === "em_analise"
            ? "A empresa já está na base do comercial, mas o contato é novo: alguém do time precisa confirmar se a oportunidade já tinha sido mapeada."
            : "Você está recebendo por ser da diretoria ou do time comercial.",
          botao: "Abrir o painel da Alavanca",
          url: `${appUrl}/#/programas/painel-alavanca`,
          logo,
        });

        if (!destinatarios.length) return json({ skipped: "sem_destinatarios" });
        if (dry_run) return json({ would_send: true, total: destinatarios.length, subject });
        return await enviar({ destinatarios, emCopiaOculta, subject, html });
      }

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
          // O "por quê" da elegibilidade só saía na recusa, dentro da tarja
          // vermelha abaixo. Mas o comercial agora decide (e explica) também as
          // que ele APROVA — e uma aprovação sem motivo deixa quem indicou sem
          // saber o que mudou desde o "depende do comercial". Aqui em linha
          // normal; recusa continua na tarja, que é onde ela pertence.
          ["Por que esta elegibilidade",
            ind.elegibilidade === "nao_elegivel" ? null : ind.elegibilidade_motivo],
          ["Situação", STATUS_ALAVANCA[ind.status] ?? ind.status],
          ["Comentário do comercial", ind.comentario],
          // O valor passou a ser editável em qualquer status (o comercial sabe
          // o prêmio antes de fechar a linha). Preso à conclusão, o e-mail
          // omitia justamente o número que quem indicou quer ver.
          ["Premiação", ind.valor_premio != null ? dinheiro(ind.valor_premio) : null],
          ["Pagamento", dataBr(ind.pago_em)],
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

    // ---- pedido de uma iniciativa da Inovação para uma obra ----
    if (evento === "iniciativa_pedido_novo" || evento === "iniciativa_pedido_status") {
      if (!pedido_id) return json({ error: "missing_pedido_id" }, 400);
      const { data: pedido, error } = await supabase
        .from("programas_iniciativa_pedidos")
        .select("numero, iniciativa_titulo, obra_cod_phd, justificativa, status, resposta, solicitante_id")
        .eq("id", pedido_id)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!pedido) return json({ skipped: "not_found" });

      const { data: quem } = await supabase
        .from("colaboradores").select("nome, email").eq("id", pedido.solicitante_id).maybeSingle();

      if (evento === "iniciativa_pedido_novo") {
        // Quem trata a fila é o admin do módulo — o mesmo critério da tela
        // (programas_role = 'admin'), lido aqui para não sair do navegador.
        const { data: admins, error: eAdmins } = await supabase
          .from("colaboradores").select("email").eq("ativo", true)
          .eq("recebe_email_listas", true)
          .eq("programas_role", "admin").not("email", "is", null);
        if (eAdmins) return json({ error: eAdmins.message }, 500);
        destinatarios = [...new Set((admins ?? []).map((c) => (c.email ?? "").trim()).filter(Boolean))];
        emCopiaOculta = true;

        subject = `Iniciativas: pedido #${pedido.numero} — ${pedido.iniciativa_titulo}`;
        html = montarHtml({
          saudacao: "Olá!",
          chamada: `<strong>${escapeHtml(quem?.nome ?? "Um colaborador")}</strong> pediu uma iniciativa para uma obra.`,
          linhas: [
            ["Iniciativa", `#${pedido.numero} — ${pedido.iniciativa_titulo}`],
            ["Obra", pedido.obra_cod_phd],
            ["Quem pediu", quem?.nome],
            ["Para que precisa", pedido.justificativa],
          ],
          aviso: "Você está recebendo por administrar o módulo Programas.",
          botao: "Abrir os pedidos",
          url: `${appUrl}/#/programas/iniciativas`,
          logo,
        });
      } else {
        if (!quem?.email) return json({ skipped: "solicitante_sem_email" });
        destinatarios = [quem.email];

        subject = `Iniciativas: retorno sobre o seu pedido #${pedido.numero}`;
        html = montarHtml({
          saudacao: `Olá, <strong>${escapeHtml((quem.nome ?? "").split(" ")[0])}</strong>.`,
          chamada: `Há novidade no seu pedido de <strong>${escapeHtml(pedido.iniciativa_titulo)}</strong> para a obra ${escapeHtml(pedido.obra_cod_phd)}.`,
          linhas: [
            ["Iniciativa", pedido.iniciativa_titulo],
            ["Obra", pedido.obra_cod_phd],
            ["Situação", STATUS_PEDIDO[pedido.status] ?? pedido.status],
          ],
          // A resposta é o que responde "por quê?" — sem ela, recusa vira só
          // uma negativa, e aprovação não diz o "quando".
          alerta: pedido.resposta
            ? `<strong>Resposta da Inovação:</strong><br>${escapeHtml(pedido.resposta)}`
            : null,
          botao: "Ver no Portal PHD",
          url: `${appUrl}/#/programas/iniciativas`,
          logo,
        });
      }
    }

    if (!destinatarios.length) return json({ skipped: "sem_destinatarios" });
    if (dry_run) return json({ would_send: true, total: destinatarios.length, subject });
    return await enviar({ destinatarios, emCopiaOculta, subject, html });
  } catch (e) {
    console.error("[notify-programa]", e);
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});
