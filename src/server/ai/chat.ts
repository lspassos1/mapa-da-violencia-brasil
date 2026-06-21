// Completador de texto genérico multi-provedor (free tier) — SERVER-ONLY.
//
// Reusa as MESMAS chaves AI_* do extrator OSINT (providers.ts), mas devolve texto
// livre (não JSON de extração). Mantido separado de propósito: não mexer no
// pipeline OSINT que já funciona. Para uso esporádico (ex.: digest semanal), tenta
// cada provedor configurado EM ORDEM até um responder — sem round-robin (1 chamada).
//
// OpenAI (AI_OPENAI_API_KEY) é paga e fica FORA daqui de propósito (vide #89).
import "server-only";

interface ChatProvider {
  name: string;
  configured: () => boolean;
  chat: (system: string, user: string) => Promise<string | null>;
}

async function openAICompat(
  system: string,
  user: string,
  opts: { url: string; key: string; model: string; extraHeaders?: Record<string, string> },
): Promise<string | null> {
  const res = await fetch(opts.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.key}`, "Content-Type": "application/json", ...opts.extraHeaders },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      model: opts.model,
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${opts.model} ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  return typeof text === "string" && text.trim() ? text.trim() : null;
}

async function gemini(system: string, user: string, key: string): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0.3 },
    }),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === "string" && text.trim() ? text.trim() : null;
}

async function cloudflare(system: string, user: string, accountId: string, token: string): Promise<string | null> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.3,
    }),
  });
  if (!res.ok) throw new Error(`cloudflare ${res.status}`);
  const data = await res.json();
  const text = data?.result?.response;
  return typeof text === "string" && text.trim() ? text.trim() : null;
}

const PROVIDERS: ChatProvider[] = [
  { name: "gemini", configured: () => !!process.env.AI_GEMINI_API_KEY,
    chat: (s, u) => gemini(s, u, process.env.AI_GEMINI_API_KEY!) },
  { name: "groq", configured: () => !!process.env.AI_GROQ_API_KEY,
    chat: (s, u) => openAICompat(s, u, { url: "https://api.groq.com/openai/v1/chat/completions", key: process.env.AI_GROQ_API_KEY!, model: "llama-3.3-70b-versatile" }) },
  { name: "cloudflare", configured: () => !!(process.env.AI_CLOUDFLARE_API_TOKEN && process.env.AI_CLOUDFLARE_ACCOUNT_ID),
    chat: (s, u) => cloudflare(s, u, process.env.AI_CLOUDFLARE_ACCOUNT_ID!, process.env.AI_CLOUDFLARE_API_TOKEN!) },
  { name: "mistral", configured: () => !!process.env.AI_MISTRAL_API_KEY,
    chat: (s, u) => openAICompat(s, u, { url: "https://api.mistral.ai/v1/chat/completions", key: process.env.AI_MISTRAL_API_KEY!, model: "mistral-small-latest" }) },
  { name: "openrouter", configured: () => !!process.env.AI_OPENROUTER_API_KEY,
    chat: (s, u) => openAICompat(s, u, { url: "https://openrouter.ai/api/v1/chat/completions", key: process.env.AI_OPENROUTER_API_KEY!, model: "meta-llama/llama-3.3-70b-instruct", extraHeaders: { "HTTP-Referer": "https://mapa-da-violencia-brasil.vercel.app", "X-Title": "Mapa da Violencia Brasil" } }) },
  { name: "together", configured: () => !!process.env.AI_TOGETHER_API_KEY,
    chat: (s, u) => openAICompat(s, u, { url: "https://api.together.xyz/v1/chat/completions", key: process.env.AI_TOGETHER_API_KEY!, model: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free" }) },
];

export function hasChatProvider(): boolean {
  return PROVIDERS.some((p) => p.configured());
}

export interface ChatResult {
  text: string;
  provedor: string;
}

// Tenta cada provedor configurado em ordem até um responder. null se nenhum
// estiver configurado ou todos falharem.
export async function completeText(system: string, user: string): Promise<ChatResult | null> {
  for (const p of PROVIDERS) {
    if (!p.configured()) continue;
    try {
      const text = await p.chat(system, user);
      if (text) return { text, provedor: p.name };
    } catch {
      // falha/quota -> tenta o próximo
    }
  }
  return null;
}
