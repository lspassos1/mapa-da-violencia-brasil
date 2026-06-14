#!/usr/bin/env node
// Gera src/data/municipios.json — indice compacto p/ geocoding da camada OSINT.
// Le public/officialCrimeData.json.gz e extrai 1 entrada unica por municipio:
//   [idIbge, municipio, uf, lat, lng]
// Usado server-side por src/server/osint/geocode.ts (sem fs/fetch em runtime).
import { gunzipSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";

const gz = readFileSync(new URL("../public/officialCrimeData.json.gz", import.meta.url));
const data = JSON.parse(gunzipSync(gz).toString("utf-8"));
const seen = new Map();
for (const it of data.items ?? []) {
  if (!it.idIbge || seen.has(it.idIbge)) continue;
  if (typeof it.lat !== "number" || typeof it.lng !== "number") continue;
  seen.set(it.idIbge, [it.idIbge, it.municipio, it.uf, Number(it.lat.toFixed(4)), Number(it.lng.toFixed(4))]);
}
const rows = [...seen.values()].sort((a, b) => a[0].localeCompare(b[0]));
const out = new URL("../src/data/municipios.json", import.meta.url);
writeFileSync(out, JSON.stringify(rows));
console.log(`municipios.json: ${rows.length} municipios, ${(JSON.stringify(rows).length/1024).toFixed(0)} KB`);
