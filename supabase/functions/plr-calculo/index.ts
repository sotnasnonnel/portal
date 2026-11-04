// O PLR por pessoa: junta as pessoas do portal (plr_pessoas) com o que o HUB
// sabe (% de cada setor e o valor da gerência).
//
// Fica em Edge Function por dois motivos: a chave do backoffice não pode ir para
// o navegador, e a conta sai pronta, com só o que a pessoa pode ver. Quem decide
// quais linhas ela vê é a RPC plr_pessoas_visiveis, chamada com o token dela.
//
// Resposta: ver montarResultado em calculo.ts.
//
// DEPLOY: `supabase functions deploy plr-calculo`. Usa os secrets que já existem:
// BACKOFFICE_SUPABASE_URL e BACKOFFICE_SERVICE_ROLE_KEY.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { montarResultado } from "./calculo.ts";
import { carregarHub } from "./hub.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  if (status >= 400) console.error("[plr-calculo]", status, JSON.stringify(body));
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!/^Bearer\s+\S+/i.test(authHeader)) return json({ error: "sem_token" }, 401);

    const { ano } = await req.json().catch(() => ({ ano: null }));
    if (!Number.isInteger(ano) || ano < 2020 || ano > 2100) return json({ error: "ano_invalido" }, 400);

    const comoUsuario = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: dadosUser, error: eUser } = await comoUsuario.auth.getUser();
    if (eUser || !dadosUser?.user?.id) return json({ error: "sem_token" }, 401);

    // Quem está pedindo sai do token, nunca do corpo do pedido.
    const { data: visiveis, error: eVis } = await comoUsuario.rpc("plr_pessoas_visiveis", { p_ano: ano });
    if (eVis) return json({ error: eVis.message }, 500);
    if (!visiveis?.papel) return json({ error: "sem_acesso" }, 403);

    // Sem cair num valor padrão aqui: errar a conta de todo mundo em silêncio é pior que a tela dar erro.
    const { data: multEmpresa, error: eMult } = await comoUsuario.rpc("plr_mult_empresa", { p_ano: ano });
    if (eMult) return json({ error: eMult.message }, 500);

    const backUrl = Deno.env.get("BACKOFFICE_SUPABASE_URL");
    const backKey = Deno.env.get("BACKOFFICE_SERVICE_ROLE_KEY");
    if (!backUrl || !backKey) return json({ error: "backoffice_nao_configurado" }, 500);
    const backoffice = createClient(backUrl, backKey, { auth: { persistSession: false } });

    const { erro: erroHub, parametros, pessoasHub } = await carregarHub(backoffice, ano);
    if (erroHub) return json({ error: erroHub }, 502);

    return json(montarResultado({
      ano,
      papel: visiveis.papel,
      veTodos: !!visiveis.ve_todos,
      multEmpresa: Number(multEmpresa),
      pessoas: visiveis.pessoas ?? [],
      parametros,
      pessoasHub,
    }));
  } catch (e) {
    console.error("[plr-calculo]", e);
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});
