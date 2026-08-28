// Classifica uma INICIATIVA do Campo de Ideias como item do catálogo da
// empresa: cria a linha em `inovacao_pipeline` no projeto BACKOFFICE e marca o
// registro do portal com o id que ela ganhou lá.
//
// Por que uma Edge Function, e não o navegador falando com o backoffice: a
// escrita naquele projeto exige service-role, e essa chave não pode ir para o
// bundle. Aqui ela é secret do servidor. É também o único lugar do portal que
// grava nos DOIS bancos — se um dia houver um segundo, este é o arquivo a
// copiar, não o padrão a reinventar.
//
// Quem pode: só o ADMIN do módulo Programas. A checagem é feita aqui com o JWT
// de quem chamou, e não confiando no que o cliente mandou — o cliente escondeu
// o botão, mas esconder botão não é autorização.
//
// Body: { ideia_id, area, estagio, responsavel?, dry_run? }
//   area    -> INO | OPE | PAR (as três do backoffice)
//   estagio -> IDEIA | USO EM ATUAÇÃO | FATURAMENTO
// dry_run responde o que seria criado, sem gravar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

const AREAS = ["INO", "OPE", "PAR"];
// Não há CHECK na tabela de lá; a lista é o que já existe em uso. Aceitar texto
// livre encheria o catálogo de estágios escritos de três jeitos.
const ESTAGIOS = ["IDEIA", "USO EM ATUAÇÃO", "FATURAMENTO"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    let ideia_id: string | null = null;
    let area = "";
    let estagio = "";
    let responsavel: string | null = null;
    let dry_run = false;
    try {
      ({ ideia_id = null, area = "", estagio = "", responsavel = null, dry_run = false } = await req.json());
    } catch {
      return json({ error: "invalid_body" }, 400);
    }
    if (!ideia_id) return json({ error: "missing_ideia_id" }, 400);
    if (!AREAS.includes(area)) return json({ error: "invalid_area" }, 400);
    if (!ESTAGIOS.includes(estagio)) return json({ error: "invalid_estagio" }, 400);

    const portalUrl = Deno.env.get("SUPABASE_URL")!;
    const portal = createClient(portalUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });

    // ---- quem está chamando ----
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "sem_token" }, 401);

    const { data: auth, error: eAuth } = await portal.auth.getUser(token);
    if (eAuth || !auth?.user) return json({ error: "token_invalido" }, 401);

    const { data: quem, error: eQuem } = await portal
      .from("colaboradores")
      .select("id, nome, programas_role")
      .eq("auth_id", auth.user.id)
      .maybeSingle();
    if (eQuem) return json({ error: eQuem.message }, 500);
    if (quem?.programas_role !== "admin") return json({ error: "sem_permissao" }, 403);

    // ---- o registro do portal ----
    const { data: ideia, error: eIdeia } = await portal
      .from("programas_ideias")
      .select("id, numero, tipo, titulo, descricao, finalidade, setor, autor_id, pipeline_id")
      .eq("id", ideia_id)
      .maybeSingle();
    if (eIdeia) return json({ error: eIdeia.message }, 500);
    if (!ideia) return json({ error: "ideia_nao_encontrada" }, 404);
    if (ideia.pipeline_id) return json({ error: "ja_classificada", pipeline_id: ideia.pipeline_id }, 409);

    const { data: autor } = await portal
      .from("colaboradores").select("nome").eq("id", ideia.autor_id).maybeSingle();

    // A descrição do catálogo é o que a pessoa escreveu: `finalidade` na
    // iniciativa, `descricao` na ideia. Reescrever aqui seria pôr texto meu na
    // boca de quem criou.
    const subtitulo = (ideia.finalidade || ideia.descricao || "").trim() || null;
    // O prefixo mantém a origem rastreável do lado do backoffice, como o
    // 'pip-' que as linhas de lá já usam.
    const novoId = `pip-${crypto.randomUUID()}`;

    const linha = {
      id: novoId,
      titulo: ideia.titulo,
      subtitulo,
      area,
      estagio,
      responsavel: (responsavel || autor?.nome || "").trim() || null,
      data_estagio: new Date().toISOString().slice(0, 10),
      ordem: 0,
      modulos: [],
    };

    if (dry_run) return json({ would_create: linha });

    const backUrl = Deno.env.get("BACKOFFICE_SUPABASE_URL");
    const backKey = Deno.env.get("BACKOFFICE_SERVICE_ROLE_KEY");
    if (!backUrl || !backKey) return json({ error: "backoffice_nao_configurado" }, 500);

    const backoffice = createClient(backUrl, backKey, { auth: { persistSession: false } });
    const { error: eInsert } = await backoffice.from("inovacao_pipeline").insert(linha);
    if (eInsert) return json({ error: `backoffice: ${eInsert.message}` }, 500);

    // Marca só DEPOIS de gravar lá: marcado sem existir no catálogo seria um
    // registro que se diz classificado e não aparece em lugar nenhum. Se esta
    // parte falhar, a linha do backoffice fica órfã — e órfã dá para ver e
    // apagar, ao contrário de uma classificação fantasma.
    const { error: eMarca } = await portal
      .from("programas_ideias")
      .update({ pipeline_id: novoId, classificado_em: new Date().toISOString() })
      .eq("id", ideia.id);
    if (eMarca) return json({ error: eMarca.message, pipeline_id: novoId, aviso: "criada_no_backoffice" }, 500);

    return json({ ok: true, pipeline_id: novoId, titulo: ideia.titulo });
  } catch (e) {
    console.error("[classificar-iniciativa]", e);
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});
