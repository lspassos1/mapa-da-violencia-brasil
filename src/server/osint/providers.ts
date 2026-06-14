// Provedores de IA (free tier) para extracao OSINT, com ROTACAO inteligente.
//
// Estrategia p/ maximizar o teto diario gratuito: em vez de martelar sempre o
// mesmo provedor, distribui os artigos em round-robin pelos provedores
// configurados (cada um faz ~1/N das chamadas) e, ao receber 429 (quota), tira
// aquele provedor do rodizio pelo resto da execucao (cooldown). Assim a
// capacidade diaria efetiva soma a de todos os provedores.
//
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

const TIPOS: NewsExtraction["tipo"][] = [
  "homicidio", "feminicidio", "latrocinio", "roubo", "furto",
  "trafico", "violencia_sexual", "violencia_politica", "outro",
];

function buildUserPrompt(a: RawArticle): string {
  return `TITULO: ${a.titulo}\nRESUMO: ${a.resumo}\nVEICULO: ${a.veiculo}`;
}

// Extrai o primeiro objeto JSON de um texto (tolerante a cercas ```json e prosa).
function parseJsonLoose(text: string): unknown {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  return JSON.parse(m[0]);
}

// Normaliza/valida a saida crua do modelo num NewsExtraction seguro.
// `tipo` fora do conjunto conhecido recai em "outro" (nunca vaza valor cru).
function coerce(raw: unknown): NewsExtraction | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.ehCrimeViolento !== "boolean") return null;
  const conf = typeof o.confianca === "number" ? Math.max(0, Math.min(1, o.confianca)) : 0;
  const tipo = typeof o.tipo === "string" && (TIPOS as string[]).includes(o.tipo)
    ? (o.tipo as NewsExtraction["tipo"])
    : "outro";
  return {
    ehCrimeViolento: o.ehCrimeViolento,
    tipo,
    municipio: typeof o.municipio === "string" && o.municipio ? o.municipio : null,
    uf: typeof o.uf === "string" && o.uf ? o.uf.toUpperCase().slice(0, 2) : null,
    vitimas: typeof o.vitimas === "number" ? o.vitimas : null,
    dataOcorrencia: typeof o.dataOcorrencia === "string" && o.dataOcorrencia ? o.dataOcorrencia : null,
    confianca: conf,
    resumo: typeof o.resumo === "string" ? o.resumo : "",
  };
}

// --- Implementacoes por provedor (cada uma lanca em erro/HTTP para o rodizio) ---

async function viaGemini(a: RawArticle, key: string): Promise<NewsExtraction | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: buildUserPrompt(a) }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0 },
    }),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text ? coerce(parseJsonLoose(text)) : null;
}

async function viaOpenAICompat(
  a: RawArticle,
  opts: { url: string; key: string; model: string; extraHeaders?: Record<string, string> },
): Promise<NewsExtraction | null> {
  const res = await fetch(opts.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.key}`, "Content-Type": "application/json", ...opts.extraHeaders },
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
  return text ? coerce(parseJsonLoose(text)) : null;
}

async function viaCloudflare(a: RawArticle, accountId: string, token: string): Promise<NewsExtraction | null> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({
      messages: [
        { role: "system", content: SYSTEM + " Responda APENAS o JSON, sem texto extra." },
        { role: "user", content: buildUserPrompt(a) },
      ],
      temperature: 0,
    }),
  });
  if (!res.ok) throw new Error(`cloudflare ${res.status}`);
  const data = await res.json();
  const text = data?.result?.response;
  return text ? coerce(parseJsonLoose(text)) : null;
}

// --- Registro de provedores: so entra no rodizio quem tem chave configurada ---

interface Provider {
  name: string;
  isConfigured: () => boolean;
  extract: (a: RawArticle) => Promise<NewsExtraction | null>;
}

const PROVIDERS: Provider[] = [
  { name: "gemini", isConfigured: () => !!process.env.AI_GEMINI_API_KEY,
    extract: (a) => viaGemini(a, process.env.AI_GEMINI_API_KEY!) },
  { name: "groq", isConfigured: () => !!process.env.AI_GROQ_API_KEY,
    extract: (a) => viaOpenAICompat(a, { url: "https://api.groq.com/openai/v1/chat/completions", key: process.env.AI_GROQ_API_KEY!, model: "llama-3.3-70b-versatile" }) },
  { name: "cloudflare", isConfigured: () => !!(process.env.AI_CLOUDFLARE_API_TOKEN && process.env.AI_CLOUDFLARE_ACCOUNT_ID),
    extract: (a) => viaCloudflare(a, process.env.AI_CLOUDFLARE_ACCOUNT_ID!, process.env.AI_CLOUDFLARE_API_TOKEN!) },
  { name: "mistral", isConfigured: () => !!process.env.AI_MISTRAL_API_KEY,
    extract: (a) => viaOpenAICompat(a, { url: "https://api.mistral.ai/v1/chat/completions", key: process.env.AI_MISTRAL_API_KEY!, model: "mistral-small-latest" }) },
  { name: "openrouter", isConfigured: () => !!process.env.AI_OPENROUTER_API_KEY,
    extract: (a) => viaOpenAICompat(a, { url: "https://openrouter.ai/api/v1/chat/completions", key: process.env.AI_OPENROUTER_API_KEY!, model: "meta-llama/llama-3.3-70b-instruct", extraHeaders: { "HTTP-Referer": "https://mapa-da-violencia-brasil.vercel.app", "X-Title": "Mapa da Violencia Brasil" } }) },
  { name: "together", isConfigured: () => !!process.env.AI_TOGETHER_API_KEY,
    extract: (a) => viaOpenAICompat(a, { url: "https://api.together.xyz/v1/chat/completions", key: process.env.AI_TOGETHER_API_KEY!, model: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free" }) },
];

export interface ExtractResult {
  extraction: NewsExtraction;
  provedor: string;
}

// Cria um extrator com rodizio round-robin entre os provedores configurados.
// - Distribui artigos por todos (cada um ~1/N) p/ poupar a quota diaria de cada.
// - Em 429 (quota), poe o provedor em cooldown pelo resto da execucao.
// - Por artigo, se o provedor da vez falha, tenta os demais antes de desistir.
export function createExtractor(): (a: RawArticle) => Promise<ExtractResult | null> {
  const pool = PROVIDERS.filter((p) => p.isConfigured());
  const cooled = new Set<string>();
  let cursor = 0;
  return async (a) => {
    if (pool.length === 0) return null;
    for (let tries = 0; tries < pool.length; tries++) {
      const p = pool[cursor % pool.length];
      cursor++;
      if (cooled.has(p.name)) continue;
      try {
        const extraction = await p.extract(a);
        if (extraction) return { extraction, provedor: p.name };
      } catch (err) {
        if (String(err).includes("429")) cooled.add(p.name); // quota: fora do rodizio
      }
    }
    return null;
  };
}

// Quantos provedores estao configurados (p/ meta/diagnostico).
export function configuredProviderCount(): number {
  return PROVIDERS.filter((p) => p.isConfigured()).length;
}
