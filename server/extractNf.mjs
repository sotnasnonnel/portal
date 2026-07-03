// Extracao de dados de Nota Fiscal via Google Gemini (visao). SERVER-SIDE apenas.
// Usado pelo endpoint de desenvolvimento do Vite (vite.config.js).
// NUNCA importar no codigo do frontend: a chave da API nao pode ir pro bundle do navegador.
//
// Por que Gemini e nao DeepSeek: a API da DeepSeek nao aceita imagem (so texto).
// O contrato de saida (JSON) e identico, entao trocar de provedor mexe so aqui.

// Categorias que viram a "descricao" (Item) da linha do reembolso.
export const EXTRACTION_CATEGORIAS = [
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
- local: nome do estabelecimento e a cidade/UF.
- observacoes: APENAS notas gerais (forma de pagamento, numero da mesa, etc.). NAO repita aqui o estabelecimento, o numero da nota, nem a lista de itens.
- Se um campo nao existir na imagem, use null (ou lista vazia para itens).
- Nao invente dados.`;

function safeParseJson(content) {
  // Remove cercas markdown se o modelo devolver ```json ... ```
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  return JSON.parse(cleaned);
}

/**
 * Chama o Gemini e devolve o objeto extraido.
 * @param {{ dataUrl: string, apiKey: string, model?: string, baseUrl?: string }} opts
 *   dataUrl no formato "data:image/jpeg;base64,...."
 * @returns {Promise<object>} dados estruturados (+ _usage com tokens)
 */
export async function extractNf({
  dataUrl,
  apiKey,
  model = "gemini-2.5-flash",
  baseUrl = "https://generativelanguage.googleapis.com/v1beta",
}) {
  if (!apiKey) throw new Error("GEMINI_API_KEY ausente.");
  if (!dataUrl) throw new Error("Imagem (dataUrl) ausente.");

  const match = /^data:(.+?);base64,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error("Formato de imagem invalido (esperado data URL base64).");
  const [, mimeType, base64] = match;

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      {
        role: "user",
        parts: [
          { inline_data: { mime_type: mimeType, data: base64 } },
          { text: "Extraia os dados desta nota fiscal e retorne o JSON." },
        ],
      },
    ],
    generationConfig: { responseMimeType: "application/json", temperature: 0 },
  };

  const url = `${baseUrl}/models/${model}:generateContent`;
  const payload = JSON.stringify(body);

  // Retry com backoff: 429/500/503 do Gemini sao tipicamente transitorios (sobrecarga).
  let res;
  for (let attempt = 1; attempt <= 3; attempt++) {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: payload,
    });
    if (res.ok) break;
    if ([429, 500, 503].includes(res.status) && attempt < 3) {
      await new Promise((r) => setTimeout(r, attempt * 1000));
      continue;
    }
    const txt = await res.text().catch(() => "");
    throw new Error(`Gemini HTTP ${res.status}: ${txt.slice(0, 300)}`);
  }

  const json = await res.json();
  const candidate = json.candidates?.[0];
  const content = (candidate?.content?.parts ?? []).map((p) => p.text ?? "").join("");

  if (!content) {
    const reason =
      candidate?.finishReason || json.promptFeedback?.blockReason || "sem conteudo";
    throw new Error(`Gemini nao retornou texto (${reason}).`);
  }

  let parsed;
  try {
    parsed = safeParseJson(content);
  } catch {
    throw new Error(`Resposta nao era JSON valido: ${content.slice(0, 200)}`);
  }

  parsed._usage = json.usageMetadata?.totalTokenCount ?? null;
  return parsed;
}
