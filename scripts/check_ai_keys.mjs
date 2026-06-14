#!/usr/bin/env node
// Valida as chaves dos provedores de IA (free tier) lendo de .env.local.
// Faz um pedido minimo de verificacao a cada provedor e imprime apenas o
// estado (ativa / falha) — NUNCA imprime o valor das chaves.
//
// Uso: node scripts/check_ai_keys.mjs   (ou: npm run check:ai-keys)
import { readFileSync } from "node:fs";

// Lê .env.local sem dependencias (KEY=VALUE por linha; ignora comentarios).
function loadEnvLocal() {
  const env = {};
  let raw = "";
  try {
    raw = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
  } catch {
    console.error("Sem .env.local — nada para verificar.");
    process.exit(1);
  }
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

const env = loadEnvLocal();

async function ping(url, headers) {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, status: (e.name === "TimeoutError" ? "timeout" : "erro de rede") };
  }
}

const checks = [
  {
    name: "Gemini",
    key: env.GEMINI_API_KEY,
    run: (k) => ping(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(k)}`),
  },
  {
    name: "Groq",
    key: env.GROQ_API_KEY,
    run: (k) => ping("https://api.groq.com/openai/v1/models", { Authorization: `Bearer ${k}` }),
  },
  {
    name: "OpenRouter",
    key: env.OPENROUTER_API_KEY,
    run: (k) => ping("https://openrouter.ai/api/v1/key", { Authorization: `Bearer ${k}` }),
  },
  {
    name: "Together",
    key: env.TOGETHER_API_KEY,
    run: (k) => ping("https://api.together.xyz/v1/models", { Authorization: `Bearer ${k}` }),
  },
  {
    name: "Mistral",
    key: env.MISTRAL_API_KEY,
    run: (k) => ping("https://api.mistral.ai/v1/models", { Authorization: `Bearer ${k}` }),
  },
  {
    name: "Cloudflare",
    key: env.CLOUDFLARE_API_TOKEN,
    run: (k) => ping("https://api.cloudflare.com/client/v4/user/tokens/verify", { Authorization: `Bearer ${k}` }),
  },
];

const results = await Promise.all(
  checks.map(async (c) => {
    if (!c.key) return { name: c.name, label: "— sem chave em .env.local" };
    const { ok, status } = await c.run(c.key);
    return { name: c.name, label: ok ? "OK (ativa)" : `FALHA (${status})` };
  }),
);

console.log("Estado das chaves de IA (de .env.local):\n");
for (const r of results) console.log(`  ${r.name.padEnd(12)} ${r.label}`);
if (!env.CLOUDFLARE_ACCOUNT_ID) {
  console.log("\n  Nota: CLOUDFLARE_ACCOUNT_ID vazio — necessario para chamar o Workers AI.");
}
