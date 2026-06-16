// Gera src/data/monthlySeries.json a partir da tabela crime_uf_mensal (Supabase,
// série mensal oficial). Asset ESTÁTICO bundleado (mesmo padrão de municipios.json)
// — o radar de anomalia (#85) lê dele em runtime, sem dependência Supabase.
//
// Uso: SUPABASE_SERVICE_ROLE_KEY no .env.local; depois `node scripts/build_monthly_series.mjs`.
// Reexecutar quando a base mensal for atualizada.
import { readFileSync, writeFileSync } from "node:fs";

function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

const env = loadEnv(".env.local");
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local");

const INDICADOR = "homicidioDoloso"; // indicador-âncora do radar eleitoral
const headers = { apikey: key, Authorization: `Bearer ${key}` };
const step = 1000;
let rows = [];
for (let offset = 0; ; offset += step) {
  const q = `${url}/rest/v1/crime_uf_mensal?select=nivel,mes,valor&indicador=eq.${INDICADOR}&order=nivel.asc,mes.asc&limit=${step}&offset=${offset}`;
  const res = await fetch(q, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const batch = await res.json();
  rows.push(...batch);
  if (batch.length < step) break;
}

// { "AC": { "2015-01": 12, ... }, ..., "BR": {...} }
const asset = {};
for (const r of rows) {
  (asset[r.nivel] ??= {})[r.mes] = r.valor;
}

const out = "src/data/monthlySeries.json";
writeFileSync(out, JSON.stringify({ indicador: INDICADOR, series: asset }) + "\n");
console.log(`OK — ${rows.length} linhas, ${Object.keys(asset).length} níveis → ${out}`);
