// O total do PLR dos colaboradores, para a tela Resultado do HUB. É a mesma conta
// de plr-calculo, feita na hora: o HUB nunca fica com uma cópia velha do número.
//
// Quem chama é o navegador do HUB, com o token de login DE LÁ. Por isso o token
// não vale neste projeto, a função é publicada sem a checagem de JWT do Supabase
// e a checagem real é feita abaixo, no banco do HUB: ele recusa token inválido, e
// is_plr_ve_tudo diz se a pessoa vê o PLR inteiro.
//
// Resposta: só agregados (resumoParaHub, em calculo.ts).
//
// DEPLOY: `supabase functions deploy plr-total-colaboradores --no-verify-jwt`.
// Sem a flag, o Supabase barra o token do HUB antes de chegar aqui.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { montarResultado, MULT_EMPRESA_PADRAO, resumoParaHub, soAtivas } from "../plr-calculo/calculo.ts";
import { carregarHub } from "../plr-calculo/hub.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  if (status >= 400) console.error("[plr-total-colaboradores]", status, JSON.stringify(body));
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

    const backUrl = Deno.env.get("BACKOFFICE_SUPABASE_URL");
    const backKey = Deno.env.get("BACKOFFICE_SERVICE_ROLE_KEY");
    if (!backUrl || !backKey) return json({ error: "backoffice_nao_configurado" }, 500);

    // Com o Authorization da pessoa, o banco do HUB responde como ela, não como a chave.
    const comoUsuarioHub = createClient(backUrl, backKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: veTudo, error: eAcesso } = await comoUsuarioHub.rpc("is_plr_ve_tudo");
    if (eAcesso) return json({ error: "sem_token" }, 401);
    if (veTudo !== true) return json({ error: "sem_acesso" }, 403);

    const backoffice = createClient(backUrl, backKey, { auth: { persistSession: false } });
    const { erro: erroHub, parametros, pessoasHub } = await carregarHub(backoffice, ano);
    if (erroHub) return json({ error: erroHub }, 502);

    const portal = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const [{ data: pessoas, error: ePes }, { data: config, error: eCfg }] = await Promise.all([
      portal.from("plr_pessoas")
        .select("id, nome, cod_ct, setor_hub, cargo_plr, salario, data_admissao, data_demissao, hub_chave, colaboradores(ativo)")
        .eq("ano", ano)
        .is("hub_chave", null),
      portal.from("plr_config").select("mult_empresa").eq("ano", ano).maybeSingle(),
    ]);
    if (ePes) return json({ error: ePes.message }, 500);
    if (eCfg) return json({ error: eCfg.message }, 500);

    return json(resumoParaHub(montarResultado({
      ano,
      papel: "hub",
      veTodos: true,
      multEmpresa: config ? Number(config.mult_empresa) : MULT_EMPRESA_PADRAO,
      pessoas: soAtivas(pessoas ?? []),
      parametros,
      pessoasHub,
    })));
  } catch (e) {
    console.error("[plr-total-colaboradores]", e);
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});
