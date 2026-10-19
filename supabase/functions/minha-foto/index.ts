// A MINHA foto, vinda do backoffice (hub).
//
// A bolinha do usuário (cabeçalho, menu lateral, Personalização) baixa a foto
// do Microsoft 365 com o session.provider_token — que só existe no RETORNO do
// login. Quem entrou antes do recurso existir, ou cujo tenant recusou o
// User.Read, ficava nas iniciais para sempre, mesmo tendo foto sincronizada no
// hub (a mesma que a lista de aniversariantes da Home mostra). Esta função é o
// plano B: devolve a própria foto do hub, e só a própria.
//
// Não existe chave estrangeira entre os dois bancos: o vínculo é por nome (ver
// casar.ts). O casamento precisa de TODOS os ativos dos dois lados — é assim
// que um nome curto do hub que serviria para duas pessoas fica de fora, em vez
// de mostrar a foto de outra pessoa.
//
// Resposta: { dataUrl } (a imagem já em base64, são ~4 KB) ou { dataUrl: null }
// quando a pessoa não tem foto no hub ou o nome não casou.
//
// DEPLOY: `supabase functions deploy minha-foto` resolve o import do casar.ts
// vizinho (que é a fonte única da regra, com os testes ao lado). Pelo painel,
// subir o casar.ts junto na pasta da função e trocar o import por "./casar.ts"
// — foi assim que a versão 1 foi publicada em 19/10/2026.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { casarFotos } from "../fotos-aniversariantes/casar.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  if (status >= 400) console.error("[minha-foto]", status, JSON.stringify(body));
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!/^Bearer\s+\S+/i.test(authHeader)) return json({ error: "sem_token" }, 401);

    const portalUrl = Deno.env.get("SUPABASE_URL")!;
    const comoUsuario = createClient(portalUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    // Quem está pedindo sai do token, nunca do corpo do pedido.
    const { data: dadosUser, error: eUser } = await comoUsuario.auth.getUser();
    const authId = dadosUser?.user?.id;
    if (eUser || !authId) return json({ error: "sem_token" }, 401);

    const backUrl = Deno.env.get("BACKOFFICE_SUPABASE_URL");
    const backKey = Deno.env.get("BACKOFFICE_SERVICE_ROLE_KEY");
    if (!backUrl || !backKey) return json({ error: "backoffice_nao_configurado" }, 500);

    const portal = createClient(portalUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const backoffice = createClient(backUrl, backKey, { auth: { persistSession: false } });
    const [{ data: eu, error: eEu }, { data: ativos, error: eAtivos }, { data: hub, error: eHub }] = await Promise.all([
      portal.from("colaboradores").select("id").eq("auth_id", authId).maybeSingle(),
      portal.from("colaboradores").select("id, nome").not("ativo", "is", false),
      backoffice.from("colaboradores").select("full_name, foto_path")
        .eq("foto_status", "ok").eq("is_active", true).is("deleted_at", null).not("foto_path", "is", null),
    ]);
    if (eEu) return json({ error: eEu.message }, 500);
    if (eAtivos) return json({ error: eAtivos.message }, 500);
    if (eHub) return json({ error: `backoffice: ${eHub.message}` }, 500);
    if (!eu) return json({ dataUrl: null });

    const path = casarFotos(ativos ?? [], hub ?? []).get(eu.id);
    if (!path) return json({ dataUrl: null });

    const { data: arquivo, error: eArquivo } = await backoffice.storage.from("avatares").download(path);
    if (eArquivo || !arquivo) return json({ dataUrl: null });

    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    const tipo = arquivo.type || "image/jpeg";
    return json({ dataUrl: `data:${tipo};base64,${btoa(bin)}` });
  } catch (e) {
    console.error("[minha-foto]", e);
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});
