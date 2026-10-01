// API de LEITURA do portal para sistemas de fora (BI, integrações).
//
// Entrega, em JSON, os dados de:
//   GET /api-portal/ausencia-programada           pedidos de Ausência Programada
//   GET /api-portal/ausencia-programada/periodos  períodos e saldo
//   GET /api-portal/adicional-ausencias           Adicional de Ausências
//   GET /api-portal/apontamentos                  Apontamento (Gestão de Horas)
//   GET /api-portal/horas-extras                  Horas Extras (Gestão de Horas)
// Contrato completo (filtros, campos, exemplos): docs/api-portal.md.
//
// Quem chama NÃO é usuário do portal, então não há JWT: a função é publicada
// com verify_jwt = false e a porta é a CHAVE do secret API_PORTAL_KEYS (uma ou
// mais, separadas por vírgula — uma por consumidor, para trocar a de um sem
// derrubar os outros). Sem o secret configurado a função responde 503 para
// todo mundo: esquecer o secret não pode virar API aberta.
//
// As consultas ficam no banco (supabase_migration_api_portal.sql), em funções
// que só a service_role executa. Aqui fica só a porta: chave, rota e filtros.
//
// Sem cabeçalhos de CORS de propósito: a chave dá a empresa toda e não pode
// morar em JavaScript de navegador. Quem consome é servidor.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

const LIMITE_PADRAO = 500;
const LIMITE_MAXIMO = 2000;

type Filtro = "de" | "ate" | "status" | "email";
type Recurso = {
  rpc: string;
  filtros: Filtro[];
  status?: string[];
  descricao: string;
};

// A chave do mapa é o caminho depois de /api-portal/.
const RECURSOS: Record<string, Recurso> = {
  "ausencia-programada": {
    rpc: "api_portal_ausencias",
    filtros: ["de", "ate", "status", "email"],
    status: ["pendente", "aprovada", "reprovada", "cancelada"],
    descricao: "Pedidos de Ausência Programada. de/ate: ausências que tocam o intervalo.",
  },
  "ausencia-programada/periodos": {
    rpc: "api_portal_ausencia_periodos",
    filtros: ["email"],
    descricao: "Períodos de referência com dias tirados, agendados, pendentes, adicionais e saldo.",
  },
  "adicional-ausencias": {
    rpc: "api_portal_adicionais",
    filtros: ["de", "ate", "status", "email"],
    status: ["pendente", "aprovada", "reprovada", "cancelada"],
    descricao: "Adicional de Ausências (dias de crédito por projeto). de/ate: dia do registro.",
  },
  "apontamentos": {
    rpc: "api_portal_apontamentos",
    filtros: ["de", "ate", "email"],
    descricao: "Apontamentos da Gestão de Horas. de/ate: dia do início do apontamento.",
  },
  "horas-extras": {
    rpc: "api_portal_horas_extras",
    filtros: ["de", "ate", "status", "email"],
    status: ["pendente", "aprovada", "reprovada", "cancelada", "compensada"],
    descricao: "Solicitações de Horas Extras. de/ate: data da hora extra.",
  },
};

// Comparação pelo hash: tempo igual para chave certa e errada, e tamanhos
// diferentes não vazam pelo tempo de resposta.
async function sha256(texto: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto)));
}
async function chaveValida(recebida: string, validas: string[]): Promise<boolean> {
  const a = await sha256(recebida);
  let achou = false;
  for (const v of validas) {
    const b = await sha256(v);
    let dif = 0;
    for (let i = 0; i < a.length; i++) dif |= a[i] ^ b[i];
    if (dif === 0) achou = true;
  }
  return achou;
}

// AAAA-MM-DD que existe no calendário (2026-02-30 não passa).
function dataValida(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function inteiro(v: string | null, padrao: number): number | null {
  if (v === null || v === "") return padrao;
  return /^\d{1,9}$/.test(v) ? Number(v) : null;
}

Deno.serve(async (req) => {
  if (req.method !== "GET") return json({ erro: "metodo_nao_permitido", mensagem: "Use GET." }, 405);

  try {
    // ---- chave ----
    const validas = (Deno.env.get("API_PORTAL_KEYS") ?? "")
      .split(",").map((k) => k.trim()).filter((k) => k.length >= 24);
    if (!validas.length) {
      console.error("[api-portal] secret API_PORTAL_KEYS ausente ou com chave curta (mínimo 24 caracteres).");
      return json({ erro: "nao_configurada", mensagem: "API ainda não configurada." }, 503);
    }
    const recebida = req.headers.get("x-api-key")
      ?? (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!recebida || !(await chaveValida(recebida, validas))) {
      return json({ erro: "nao_autorizado", mensagem: "Chave ausente ou inválida (cabeçalho x-api-key)." }, 401);
    }

    // ---- rota ----
    const url = new URL(req.url);
    const partes = url.pathname.split("/").filter(Boolean);
    const caminho = partes.slice(partes.indexOf("api-portal") + 1).join("/");
    if (!caminho) {
      return json({
        recursos: Object.entries(RECURSOS).map(([rota, r]) => ({
          rota: `/api-portal/${rota}`,
          descricao: r.descricao,
          filtros: [...r.filtros, "limite", "offset"],
          ...(r.status ? { status: r.status } : {}),
        })),
      });
    }
    const recurso = RECURSOS[caminho];
    if (!recurso) {
      return json({ erro: "recurso_nao_encontrado", mensagem: `Recursos: ${Object.keys(RECURSOS).join(", ")}.` }, 404);
    }

    // ---- filtros ----
    // Parâmetro desconhecido é erro, não é ignorado: `status=aprovado` num
    // recurso sem status, ou `data=` no lugar de `de=`, devolveria a base
    // inteira parecendo um filtro que funcionou.
    const q = url.searchParams;
    const aceitos = new Set<string>([...recurso.filtros, "limite", "offset"]);
    const estranho = [...q.keys()].find((k) => !aceitos.has(k));
    if (estranho) {
      return json({ erro: "parametro_invalido", mensagem: `Parâmetro '${estranho}' não existe neste recurso. Aceitos: ${[...aceitos].join(", ")}.` }, 400);
    }

    const args: Record<string, unknown> = {};
    for (const campo of ["de", "ate"] as const) {
      const v = q.get(campo);
      if (!v) continue;
      if (!dataValida(v)) return json({ erro: "parametro_invalido", mensagem: `'${campo}' deve ser uma data AAAA-MM-DD.` }, 400);
      args[`p_${campo}`] = v;
    }
    if (args.p_de && args.p_ate && String(args.p_de) > String(args.p_ate)) {
      return json({ erro: "parametro_invalido", mensagem: "'de' não pode ser depois de 'ate'." }, 400);
    }
    const status = q.get("status");
    if (status) {
      if (!recurso.status!.includes(status)) {
        return json({ erro: "parametro_invalido", mensagem: `'status' deve ser um de: ${recurso.status!.join(", ")}.` }, 400);
      }
      args.p_status = status;
    }
    const email = q.get("email");
    if (email) args.p_email = email;

    const limite = inteiro(q.get("limite"), LIMITE_PADRAO);
    const offset = inteiro(q.get("offset"), 0);
    if (limite === null || limite < 1 || limite > LIMITE_MAXIMO) {
      return json({ erro: "parametro_invalido", mensagem: `'limite' deve ser um inteiro entre 1 e ${LIMITE_MAXIMO}.` }, 400);
    }
    if (offset === null) {
      return json({ erro: "parametro_invalido", mensagem: "'offset' deve ser um inteiro maior ou igual a 0." }, 400);
    }
    args.p_limite = limite;
    args.p_offset = offset;

    // ---- consulta ----
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data, error } = await supabase.rpc(recurso.rpc, args);
    if (error) {
      console.error(`[api-portal] ${recurso.rpc}:`, error.message);
      return json({ erro: "falha_na_consulta", mensagem: "Não foi possível consultar os dados." }, 500);
    }

    const total = Number(data?.total ?? 0);
    const dados = data?.dados ?? [];
    return json({
      recurso: caminho,
      total,
      limite,
      offset,
      // Próxima página pronta para quem pagina: null quando acabou.
      proximo_offset: offset + dados.length < total ? offset + dados.length : null,
      dados,
    });
  } catch (e) {
    console.error("[api-portal] erro inesperado:", e);
    return json({ erro: "erro_interno", mensagem: "Erro inesperado." }, 500);
  }
});
