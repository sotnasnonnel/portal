// Edge Function: extrai dados de Nota Fiscal a partir de uma imagem ou PDF
// (data URL) usando Google Gemini. Espelha o endpoint de DEV (vite.config.js +
// server/extractNf.mjs): prompt e esquema devem ficar iguais nos dois.
//
// Contrato (idêntico ao dev):  POST { dataUrl }  ->  JSON
//   { numero_nota, local, categoria, data_nf, itens, valor_total, observacoes }
//
// Secrets necessários:
//   GEMINI_API_KEY (obrigatório)
//   GEMINI_MODEL   (opcional; default "gemini-2.5-flash")

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// Categorias que viram a "descricao" (Item) da linha do reembolso.
const EXTRACTION_CATEGORIAS = [
  "UBER",
  "ALMOÇO",
  "JANTA",
  "CAFÉ",
  "COMIDA",
  "ESTACIONAMENTO",
  "COMBUSTÍVEL",
  "PEDÁGIO",
  "HOSPEDAGEM",
  "OUTRO",
];

const SYSTEM_PROMPT = `Voce e um assistente que extrai dados de notas fiscais / recibos / comprovantes brasileiros para um sistema de reembolso de despesas.
Responda SOMENTE com um JSON valido (sem markdown, sem comentarios) neste formato exato:
{
  "numero_nota": string | null,        // numero da NF / cupom / pedido
  "local": string | null,              // estabelecimento + cidade/UF (ex: "PADARIA FAMILIA PIRES LTDA, ITABIRA - MG")
  "categoria": uma de [${EXTRACTION_CATEGORIAS.map((c) => `"${c}"`).join(", ")}],  // classificacao geral da despesa
  "data_nf": "YYYY-MM-DD" | null,       // data de emissao da nota
  "itens": [ { "descricao": string, "valor": number } ],  // UMA entrada por produto/linha do comprovante
  "valor_total": number | null,         // valor TOTAL pago (numero, ponto decimal)
  "observacoes": string | null          // notas gerais: forma de pagamento, mesa, etc.
}
Regras:
- Valores em numero com ponto decimal (ex: 45.90), sem "R$".
- Datas no formato ISO YYYY-MM-DD. Se so houver dia/mes, use o ano atual.
- Para refeicao classifique entre ALMOÇO/JANTA/CAFÉ/COMIDA conforme horario/contexto; corrida de app = UBER.
- itens: liste CADA produto/linha do comprovante separadamente, com seu valor proprio.
- EXCECAO para corrida de app (UBER/99/inDrive) e outros recibos de SERVICO:
  nao quebre o recibo em partes do preco. Linhas como "Preco da viagem",
  "Custo fixo", "Tarifa dinamica", "Taxa", "Pedagio", "Espera", "Gorjeta",
  "Desconto", "Promocao" e "Subtotal" sao a composicao de UM valor so — devolva
  UM item unico, com a descricao do servico (ex.: "UBER") e o valor do TOTAL
  cobrado. Ex.: "Preco da viagem R$ 15,47" + "Custo fixo R$ 1,50" +
  "Total R$ 16,97" -> um item de 16.97, e valor_total 16.97.
- Regra geral: a soma dos itens tem que bater com o valor_total. Se o
  comprovante tiver linhas que sao pedaco do preco (e nao produtos distintos),
  agrupe num item so.
- local: nome do estabelecimento e a cidade/UF.
- observacoes: APENAS notas gerais (forma de pagamento, numero da mesa, etc.). NAO repita aqui o estabelecimento, o numero da nota, nem a lista de itens.
- Se um campo nao existir na imagem, use null (ou lista vazia para itens).
- Nao invente dados.`;

// Esquema da resposta: com ele o Gemini e obrigado a devolver JSON valido.
// So o prompt nao bastava — num recibo da 99 o modelo comecou a quebrar a
// corrida em partes e devolveu o JSON pela metade (reporte de 04/10/2026).
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    numero_nota: { type: "STRING", nullable: true },
    local: { type: "STRING", nullable: true },
    categoria: { type: "STRING", enum: EXTRACTION_CATEGORIAS },
    data_nf: { type: "STRING", nullable: true },
    itens: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { descricao: { type: "STRING" }, valor: { type: "NUMBER" } },
        required: ["descricao", "valor"],
      },
    },
    valor_total: { type: "NUMBER", nullable: true },
    observacoes: { type: "STRING", nullable: true },
  },
  required: ["numero_nota", "local", "categoria", "data_nf", "itens", "valor_total", "observacoes"],
};

function safeParseJson(content: string) {
  // Remove cercas markdown se o modelo devolver ```json ... ```
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  return JSON.parse(cleaned);
}

class GeminiErro extends Error {}

// Retry com backoff: 429/500/503 do Gemini sao tipicamente transitorios (sobrecarga).
async function chamarGemini(url: string, apiKey: string, payload: string) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: payload,
    });
    if (res.ok) return res.json();
    if ([429, 500, 503].includes(res.status) && attempt < 3) {
      await new Promise((r) => setTimeout(r, attempt * 1000));
      continue;
    }
    const txt = await res.text().catch(() => "");
    throw new GeminiErro(`Gemini HTTP ${res.status}: ${txt.slice(0, 300)}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    let dataUrl: string | null = null;
    try {
      ({ dataUrl } = await req.json());
    } catch {
      return json({ error: "Corpo da requisição inválido." }, 400);
    }
    if (!dataUrl) return json({ error: "dataUrl ausente." }, 400);

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ error: "GEMINI_API_KEY não configurada nos secrets." }, 500);
    const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
    const baseUrl = "https://generativelanguage.googleapis.com/v1beta";

    const match = /^data:(.+?);base64,(.*)$/s.exec(dataUrl);
    if (!match) return json({ error: "Formato de anexo inválido (esperado data URL base64)." }, 400);
    const [, mimeType, base64] = match;

    const body = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        {
          role: "user",
          parts: [
            { inline_data: { mime_type: mimeType, data: base64 } },
            { text: "Extraia os dados desta nota fiscal / recibo e retorne o JSON." },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0,
      },
    };

    const url = `${baseUrl}/models/${model}:generateContent`;
    const payload = JSON.stringify(body);

    // Duas tentativas inteiras: se mesmo com o esquema a resposta vier
    // quebrada, uma segunda chamada costuma vir certa.
    for (let rodada = 1; rodada <= 2; rodada++) {
      const result = await chamarGemini(url, apiKey, payload);
      const candidate = result.candidates?.[0];
      const content = (candidate?.content?.parts ?? [])
        .map((p: { text?: string }) => p.text ?? "")
        .join("");

      if (!content) {
        const reason =
          candidate?.finishReason || result.promptFeedback?.blockReason || "sem conteudo";
        return json({ error: `Gemini não retornou texto (${reason}).` }, 502);
      }

      try {
        return json(safeParseJson(content));
      } catch {
        if (rodada === 2) {
          console.error("[extract-nf] JSON inválido duas vezes:", content.slice(0, 500));
          return json({ error: "a leitura automática falhou. Tente de novo ou preencha o item à mão." }, 502);
        }
      }
    }
    return json({ error: "Falha na extração." }, 500);
  } catch (e) {
    if (e instanceof GeminiErro) return json({ error: e.message }, 502);
    console.error("[extract-nf] erro inesperado:", e);
    return json({ error: (e as Error)?.message || "Falha na extração." }, 500);
  }
});
