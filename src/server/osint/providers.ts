// Provedores de IA (free tier) para extracao OSINT, em cascata.
// Tenta Gemini -> Groq -> OpenRouter ate um responder JSON valido.
// Chaves SO de servidor (AI_*), nunca expostas ao cliente.
import type { NewsExtraction, RawArticle } from "@/types/news";

const SYSTEM = `Voce e um extrator de ocorrencias criminais de noticias brasileiras.
Dada uma noticia, devolva SOMENTE um JSON com este formato exato:
{"ehCrimeViolento": boolean, "tipo": "homicidio|feminicidio|latrocinio|roubo|furto|trafico|violencia_sexual|violencia_politica|outro", "municipio": string|null, "uf": "sigla de 2 letras"|null, "vitimas": number|null, "dataOcorrencia": "YYYY-MM-DD"|null, "confianca": number entre 0 e 1, "resumo": string curto}
Regras:
- ehCrimeViolento=false para opiniao, retrospectiva, politica geral, esporte, ou noticia sem uma ocorrencia concreta.
- municipio/uf = onde o fato ocorreu (nao a redacao do veiculo). uf como sigla (ex: SP, RJ).
- confianca reflete o quao explicita e a informacao na noticia.
- Nunca invente local ou vitimas; use null quando nao estiver claro.`;

function buildUserPrompt(a: RawArticle): string {
  return `TITULO: ${a.titulo}\nRESUMO: ${a.resumo}\nVEICULO: ${a.veiculo}`;
}

// Schema p/ Gemini (responseSchema) — restringe a saida a JSON estruturado.
const GEMINI_SCHEMA = {
  type: "OBJECT",
  properties: {
    ehCrimeViolento: { type: "BOOLEAN" },
    tipo: { type: "STRING" },
    municipio: { type: "STRING", nullable: true },
    uf: { type: "STRING", nullable: true },
    vitimas: { type: "INTEGER", nullable: true },
    dataOcorrencia: { type: "STRING", nullable: true },
    confianca: { type: "NUMBER" },
    resumo: { type: "STRING" },
  },
  required: ["ehCrimeViolento", "tipo", "confianca", "resumo"],
};

function coerce(raw: unknown): NewsExtraction | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.ehCrimeViolento !== "boolean") return null;
  const conf = typeof o.confianca === "number" ? Math.max(0, Math.min(1, o.confianca)) : 0;
  return {
    ehCrimeViolento: o.ehCrimeViolento,
    tipo: (typeof o.tipo === "string" ? o.tipo : "outro") as NewsExtraction["tipo"],
    municipio: typeof o.municipio === "string" && o.municipio ? o.municipio : null,
    uf: typeof o.uf === "string" && o.uf ? o.uf.toUpperCase().slice(0, 2) : null,
    vitimas: typeof o.vitimas === "number" ? o.vitimas : null,
    dataOcorrencia: typeof o.dataOcorrencia === "string" && o.dataOcorrencia ? o.dataOcorrencia : null,
    confianca: conf,
    resumo: typeof o.resumo === "string" ? o.resumo : "",
  };
}

async function viaGemini(a: RawArticle, key: string): Promise<NewsExtraction | null> {
  const model = "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: buildUserPrompt(a) }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: GEMINI_SCHEMA, temperature: 0 },
    }),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text ? coerce(JSON.parse(text)) : null;
}

// Groq e OpenRouter falam o protocolo OpenAI (chat/completions + json_object).
async function viaOpenAICompat(
  a: RawArticle,
  opts: { url: string; key: string; model: string },
): Promise<NewsExtraction | null> {
  const res = await fetch(opts.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.key}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({
      model: opts.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: buildUserPrompt(a) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${opts.model} ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  return text ? coerce(JSON.parse(text)) : null;
}

export interface ExtractResult {
  extraction: NewsExtraction;
  provedor: string;
}

// Extrai um artigo, em cascata pelos provedores configurados (env AI_*).
// Retorna null se nenhum provedor estiver configurado ou todos falharem.
export async function extractArticle(a: RawArticle): Promise<ExtractResult | null> {
  const chain: Array<{ name: string; run: () => Promise<NewsExtraction | null> }> = [];
  if (process.env.AI_GEMINI_API_KEY) {
    chain.push({ name: "gemini", run: () => viaGemini(a, process.env.AI_GEMINI_API_KEY!) });
  }
  if (process.env.AI_GROQ_API_KEY) {
    chain.push({
      name: "groq:llama-3.3-70b",
      run: () => viaOpenAICompat(a, { url: "https://api.groq.com/openai/v1/chat/completions", key: process.env.AI_GROQ_API_KEY!, model: "llama-3.3-70b-versatile" }),
    });
  }
  if (process.env.AI_OPENROUTER_API_KEY) {
    chain.push({
      name: "openrouter",
      run: () => viaOpenAICompat(a, { url: "https://openrouter.ai/api/v1/chat/completions", key: process.env.AI_OPENROUTER_API_KEY!, model: "meta-llama/llama-3.3-70b-instruct" }),
    });
  }
  for (const p of chain) {
    try {
      const extraction = await p.run();
      if (extraction) return { extraction, provedor: p.name };
    } catch {
      // tenta o proximo provedor (ex: 429/timeout)
    }
  }
  return null;
}
