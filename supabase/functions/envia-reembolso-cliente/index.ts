// Anexa ao pedido o PDF do reembolso aprovado que será COBRADO DO CLIENTE.
//
// Pedido da Alinne: todo reembolso marcado como "reembolsável pelo cliente"
// precisa ter o PDF no sistema para a cobrança. Não vai por e-mail: fica
// anexado e o Financeiro baixa pelo detalhe do pedido.
//
// Quem gera o PDF é o NAVEGADOR de quem aprova (o mesmo gerador do botão
// "Gerar PDF"), e ele sobe o arquivo no bucket 'reembolso-pdf-cliente'. Esta
// função confere e grava o resultado no registro reembolso_envios_cliente —
// que só o servidor escreve, então vale como prova de que o PDF está lá.
//
// NÃO confia no navegador: relê o pedido e só registra se ele estiver de fato
// aprovado, reembolsável e for reembolso (a mesma regra do gatilho do banco).
//
// Body: { id, path, reenviar? }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
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
    // Regerar o que já está anexado é decisão do Financeiro, não de qualquer aprovador.
    if (reenviar && !ehAdmin) return json({ error: "forbidden", motivo: "Só o Financeiro pode gerar o PDF de novo." }, 403);

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

    // ---- o PDF tem de estar de fato no bucket ----
    const pasta = path.slice(0, path.indexOf("/"));
    const nomePdf = path.slice(path.indexOf("/") + 1);
    const { data: lista, error: lsErr } = await supabase.storage
      .from("reembolso-pdf-cliente").list(pasta, { search: nomePdf });
    if (lsErr || !(lista ?? []).some((f) => f.name === nomePdf)) {
      await registrar(id, { status: "falhou", ultimo_erro: `PDF não encontrado no sistema${lsErr ? `: ${lsErr.message}` : "."}` });
      return json({ sent: false, motivo: "O PDF gerado não foi encontrado no sistema." });
    }

    // Sem e-mail: o PDF fica anexado ao pedido e o Financeiro baixa pelo
    // detalhe. 'enviado' no registro significa "anexado".
    await registrar(id, {
      status: "enviado",
      ultimo_erro: null,
      enviado_em: new Date().toISOString(),
      enviado_para: null,
      pdf_path: path,
    });
    return json({ sent: true, path });
  } catch (e) {
    console.error("[envia-reembolso-cliente] erro inesperado:", e);
    if (id) await registrar(id, { status: "falhou", ultimo_erro: `Erro inesperado: ${(e as Error)?.message ?? String(e)}` }).catch(() => {});
    return json({ error: `unhandled: ${(e as Error)?.message ?? String(e)}` }, 500);
  }
});
