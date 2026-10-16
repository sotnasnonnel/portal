// Fotos dos aniversariantes (e tempo de casa) do mês, vindas do backoffice (hub).
//
// O hub sincroniza a foto do Microsoft 365 de cada pessoa no bucket privado
// `avatares`, que só abre para usuário logado LÁ. O portal fala com o hub só
// com a chave anon, então a leitura passa por aqui, com a service-role do hub
// guardada como secret (a mesma de classificar-iniciativa).
//
// A lista de pessoas não vem do cliente: a função chama a própria RPC
// aniversariantes_mes com o JWT de quem pediu. Assim ninguém usa esta função
// para baixar a foto de qualquer colaborador, só as que a Home já mostra.
//
// Resposta: { fotos: { [colaborador_id]: url assinada } }. Quem não tem foto ou
// não casou pelo nome (ver casar.ts) simplesmente não aparece.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { casarFotos } from "./casar.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  if (status >= 400) console.error("[fotos-aniversariantes]", status, JSON.stringify(body));
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// A Home guarda a lista pelo dia; o link precisa durar o mesmo tanto.
const VALIDADE_S = 24 * 60 * 60;

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
    const { data: lista, error: eLista } = await comoUsuario.rpc("aniversariantes_mes", { p_mes: null });
    if (eLista) return json({ error: eLista.message }, 401);
    const ids = new Set((lista ?? []).map((l: { colaborador_id: string }) => l.colaborador_id));
    if (ids.size === 0) return json({ fotos: {} });

    const backUrl = Deno.env.get("BACKOFFICE_SUPABASE_URL");
    const backKey = Deno.env.get("BACKOFFICE_SERVICE_ROLE_KEY");
    if (!backUrl || !backKey) return json({ error: "backoffice_nao_configurado" }, 500);

    // O casamento precisa de TODOS os ativos, não só da lista do mês: é assim
    // que um nome curto do hub que serviria para duas pessoas fica de fora.
    const portal = createClient(portalUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const backoffice = createClient(backUrl, backKey, { auth: { persistSession: false } });
    const [{ data: ativos, error: eAtivos }, { data: hub, error: eHub }] = await Promise.all([
      portal.from("colaboradores").select("id, nome").not("ativo", "is", false),
      backoffice.from("colaboradores").select("full_name, foto_path")
        .eq("foto_status", "ok").eq("is_active", true).is("deleted_at", null).not("foto_path", "is", null),
    ]);
    if (eAtivos) return json({ error: eAtivos.message }, 500);
    if (eHub) return json({ error: `backoffice: ${eHub.message}` }, 500);

    const casadas = [...casarFotos(ativos ?? [], hub ?? [])].filter(([id]) => ids.has(id));
    if (casadas.length === 0) return json({ fotos: {} });

    const { data: links, error: eLinks } = await backoffice.storage
      .from("avatares")
      .createSignedUrls(casadas.map(([, path]) => path), VALIDADE_S);
    if (eLinks) return json({ error: `storage: ${eLinks.message}` }, 500);

    const porPath = new Map((links ?? []).filter((l) => l.signedUrl).map((l) => [l.path, l.signedUrl]));
    const fotos: Record<string, string> = {};
    for (const [id, path] of casadas) {
      const url = porPath.get(path);
      if (url) fotos[id] = url;
    }
    return json({ fotos });
  } catch (e) {
    console.error("[fotos-aniversariantes]", e);
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});
