// Gera src/data/rjShootings.json a partir da API do Fogo Cruzado (tiroteios
// georreferenciados, RJ). Asset ESTÁTICO bundleado — base da LENTE 2 do radar
// (#85, governança criminal): cruzar densidade/contexto de tiroteios com a
// letalidade/tráfico/extorsão (ISPdados) p/ distinguir "zona controlada" (poucos
// tiroteios e pouca 'Disputa', mercado ativo) de "zona em disputa" (muita guerra).
//
// Uso: FOGO_CRUZADO_EMAIL/PASSWORD no .env.local; `node scripts/build_rj_shootings.mjs`.
// Credenciais só na geração; runtime não depende da API.
import { readFileSync, writeFileSync } from "node:fs";

function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    let v = t.slice(i + 1).trim();
    if (v.length >= 2 && ((v[0] === '"' && v.at(-1) === '"') || (v[0] === "'" && v.at(-1) === "'"))) v = v.slice(1, -1);
    env[t.slice(0, i).trim()] = v;
  }
  return env;
}

const API = "https://api-service.fogocruzado.org.br/api/v2";
const RJ = "b112ffbe-17b3-4ad0-8f2a-2038745d1d14";
const ANO_INI = 2016;
const ANO_FIM = 2025;

const env = loadEnv(".env.local");
const email = env.FOGO_CRUZADO_EMAIL;
const password = env.FOGO_CRUZADO_PASSWORD;
if (!email || !password) throw new Error("Faltam FOGO_CRUZADO_EMAIL/PASSWORD no .env.local");

const login = await fetch(`${API}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
const token = (await login.json())?.data?.accessToken;
if (!token) throw new Error("login Fogo Cruzado falhou");
const headers = { Authorization: `Bearer ${token}` };

// municipio -> ano -> { oc, disputa, policia, mortos, feridos }
const series = {};
function bump(mun, ano, campo, n = 1) {
  ((series[mun] ??= {})[ano] ??= { oc: 0, disputa: 0, policia: 0, mortos: 0, feridos: 0 })[campo] += n;
}

let totalOc = 0;
for (let ano = ANO_INI; ano <= ANO_FIM; ano++) {
  for (let page = 1; ; page++) {
    const url = `${API}/occurrences?idState=${RJ}&initialdate=${ano}-01-01&finaldate=${ano}-12-31&take=1000&page=${page}`;
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(`occurrences ${ano} p${page}: HTTP ${res.status}`);
    const json = await res.json();
    const recs = json.data ?? [];
    for (const r of recs) {
      const mun = r.city?.name ?? "?";
      bump(mun, ano, "oc");
      const reason = (r.contextInfo?.mainReason?.name ?? "").toLowerCase();
      if (reason.includes("disputa")) bump(mun, ano, "disputa");
      if (r.policeAction || reason.includes("policial")) bump(mun, ano, "policia");
      for (const v of r.victims ?? []) {
        if (v.type !== "People") continue;
        if (v.situation === "Dead") bump(mun, ano, "mortos");
        else if (v.situation === "Wounded") bump(mun, ano, "feridos");
      }
    }
    totalOc += recs.length;
    if (!json.pageMeta?.hasNextPage) break;
  }
  process.stdout.write(`  ${ano} ok\n`);
}

const out = "src/data/rjShootings.json";
writeFileSync(out, JSON.stringify({ fonte: "Fogo Cruzado API v2", uf: "RJ", anos: [ANO_INI, ANO_FIM], series }) + "\n");
console.log(`OK — ${totalOc} ocorrências, ${Object.keys(series).length} municípios → ${out}`);
