#!/usr/bin/env node
// CLI: roda o pipeline OSINT contra os feeds reais e imprime os incidentes.
// Le as chaves AI_* de .env.local. Uso: node scripts/osint_extract.mjs [limite]
//
// Carrega os modulos TS via strip-types do Node 24 e resolve o alias "@/".
import { readFileSync } from "node:fs";
import { register } from "node:module";

// Resolve imports "@/..." -> src/... (mesmo hook usado pelos testes).
register("../tests/helpers/alias-hook.mjs", import.meta.url);

// injeta .env.local em process.env (sem dependencias)
try {
  for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const k = t.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = t.slice(i + 1).trim();
  }
} catch {
  console.error("Aviso: .env.local nao encontrado; usando env do processo.");
}

const limit = Number(process.argv[2] ?? 12);
const { fetchRss } = await import("../src/server/osint/rss.ts");
const { runPipeline } = await import("../src/server/osint/pipeline.ts");
const { DEFAULT_FEEDS } = await import("../src/server/osint/feeds.ts");

const articles = [];
for (const f of DEFAULT_FEEDS) {
  try {
    articles.push(...(await fetchRss(f.url, f.veiculo)));
  } catch (e) {
    console.error(`feed falhou (${f.veiculo}):`, String(e).slice(0, 80));
  }
}
const seen = new Set();
const unique = articles.filter((a) => (seen.has(a.url) ? false : (seen.add(a.url), true))).slice(0, limit);
console.error(`Artigos coletados: ${articles.length} | processando ${unique.length}…\n`);

const { incidents, stats } = await runPipeline(unique);
console.error("stats:", JSON.stringify(stats), "\n");
for (const i of incidents) {
  const loc = i.idIbge ? `${i.municipio}/${i.uf} (IBGE ${i.idIbge})` : `${i.municipio}/${i.uf} [sem geocoding]`;
  console.log(
    `[${(i.confianca * 100).toFixed(0)}% ${i.reviewStatus}] ${i.tipo} — ${loc}` +
      `${i.vitimas != null ? ` · ${i.vitimas} vítima(s)` : ""} · ${i.veiculo} (${i.provedor})\n  ${i.resumo}\n  ${i.fonteUrl}\n`,
  );
}
