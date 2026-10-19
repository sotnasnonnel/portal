// Fotos dos aniversariantes (e tempo de casa) do mês, vindas do backoffice (hub).
//
// O hub sincroniza a foto do Microsoft 365 de cada pessoa no bucket privado
// `avatares`, que só abre para usuário logado LÁ. O portal fala com o hub só
// com a chave anon, então a leitura passa por aqui, com a service-role do hub
// guardada como secret (a mesma de classificar-iniciativa).
//
// A lista de pessoas não vem do cliente: a função chama uma RPC com o JWT de
// quem pediu. Assim ninguém usa esta função para baixar a foto de qualquer
// colaborador, só as que o portal já mostra para essa pessoa:
//
//   {}                 -> a lista do mês (aniversariantes_mes), para a Home.
//   { mural: <id> }    -> quem escreveu no mural de parabéns desse
//                         aniversariante (parabens_mural), para o modal do
//                         mural — pedido do usuário, 19/10/2026: o recado tem
//                         de mostrar a foto de quem escreveu.
//
// A foto sai do hub quando ele tem; quando não tem (o hub cobre só parte da
// empresa), do próprio Microsoft 365 pela permissão de aplicativo — ver
// tokenDeApp/fotoDoGraph mais abaixo.
//
// Resposta: { fotos: { [colaborador_id]: url assinada ou data URL },
// ids: [colaborador_id] }. Quem não tem foto em lugar nenhum não aparece em
// `fotos`; `ids` é todo mundo que a função consultou, e é o que deixa o cliente
// guardar "já perguntei por essa pessoa e ela não tem foto".
//
// DEPLOY: `supabase functions deploy fotos-aniversariantes`.
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

// Plano B: a foto do Microsoft 365 pela permissão de APLICATIVO, com os mesmos
// secrets GRAPH_* das notificações. O hub (backoffice) só tem parte da empresa
// — quem não está lá, ou está sem foto sincronizada, ficava nas iniciais para
// sempre, inclusive no mural de parabéns (pedido do usuário, 19/10/2026).
//
// Precisa da permissão de APLICATIVO User.ReadBasic.All (ou User.Read.All)
// concedida ao app do Entra ID. Sem ela o Graph responde 403 e cada um segue
// nas iniciais — nada quebra, só não aparece foto.
const GRAPH_MAX = 40; // teto por pedido: a Home pede a lista do mês inteiro

async function tokenDeApp(): Promise<string | null> {
  const tenant = Deno.env.get("GRAPH_TENANT_ID");
  const clientId = Deno.env.get("GRAPH_CLIENT_ID");
  const secret = Deno.env.get("GRAPH_CLIENT_SECRET");
  if (!tenant || !clientId || !secret) return null;
  try {
    const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: secret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[fotos-aniversariantes] graph token:", res.status, data.error_description ?? "");
      return null;
    }
    return data.access_token as string;
  } catch (e) {
    console.error("[fotos-aniversariantes] graph token:", e);
    return null;
  }
}

// 96x96 é o tamanho que as bolinhas usam; se não houver essa versão, a original.
// Volta data URL (a imagem inteira, ~4 KB) porque não há link público.
async function fotoDoGraph(token: string, email: string): Promise<string | null> {
  const enderecos = [
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}/photos/96x96/$value`,
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}/photo/$value`,
  ];
  for (const url of enderecos) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const bytes = new Uint8Array(await res.arrayBuffer());
      let bin = "";
      for (const b of bytes) bin += String.fromCharCode(b);
      return `data:${res.headers.get("content-type") || "image/jpeg"};base64,${btoa(bin)}`;
    }
    // 404 = não tem essa versão da foto; o resto (403 sem permissão, 401) não
    // melhora tentando de novo.
    if (res.status !== 404) {
      if (res.status === 401 || res.status === 403) {
        console.error("[fotos-aniversariantes] graph sem permissão de aplicativo:", res.status);
      }
      return null;
    }
  }
  return null;
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
    let corpo: { mural?: unknown } = {};
    try {
      corpo = (await req.json()) ?? {};
    } catch {
      corpo = {}; // corpo vazio: a lista do mês, como sempre
    }
    const mural = typeof corpo.mural === "string" ? corpo.mural : null;

    const ids = new Set<string>();
    if (mural) {
      const { data: recados, error: eMural } = await comoUsuario.rpc("parabens_mural", { p_para: mural });
      if (eMural) return json({ error: eMural.message }, 401);
      for (const r of (recados ?? []) as { de_id: string }[]) ids.add(r.de_id);
    } else {
      const { data: lista, error: eLista } = await comoUsuario.rpc("aniversariantes_mes", { p_mes: null });
      if (eLista) return json({ error: eLista.message }, 401);
      for (const l of (lista ?? []) as { colaborador_id: string }[]) ids.add(l.colaborador_id);
    }
    const consultados = [...ids];
    if (ids.size === 0) return json({ fotos: {}, ids: consultados });

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
      portal.from("colaboradores").select("id, nome, email").not("ativo", "is", false),
      backoffice.from("colaboradores").select("full_name, foto_path")
        .eq("foto_status", "ok").eq("is_active", true).is("deleted_at", null).not("foto_path", "is", null),
    ]);
    if (eAtivos) return json({ error: eAtivos.message }, 500);
    if (eHub) return json({ error: `backoffice: ${eHub.message}` }, 500);

    const fotos: Record<string, string> = {};

    const casadas = [...casarFotos(ativos ?? [], hub ?? [])].filter(([id]) => ids.has(id));
    if (casadas.length > 0) {
      const { data: links, error: eLinks } = await backoffice.storage
        .from("avatares")
        .createSignedUrls(casadas.map(([, path]) => path), VALIDADE_S);
      if (eLinks) return json({ error: `storage: ${eLinks.message}` }, 500);

      const porPath = new Map((links ?? []).filter((l) => l.signedUrl).map((l) => [l.path, l.signedUrl]));
      for (const [id, path] of casadas) {
        const url = porPath.get(path);
        if (url) fotos[id] = url;
      }
    }

    // Quem o hub não cobriu: a foto do Microsoft 365, pelo e-mail corporativo.
    const faltando = consultados.filter((id) => !fotos[id]).slice(0, GRAPH_MAX);
    if (faltando.length > 0) {
      const token = await tokenDeApp();
      if (token) {
        const emailDe = new Map((ativos ?? []).map((a: { id: string; email: string | null }) => [a.id, a.email]));
        await Promise.all(faltando.map(async (id) => {
          const email = emailDe.get(id);
          if (!email) return;
          const url = await fotoDoGraph(token, email);
          if (url) fotos[id] = url;
        }));
      }
    }

    return json({ fotos, ids: consultados });
  } catch (e) {
    console.error("[fotos-aniversariantes]", e);
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});
