#!/usr/bin/env node
// Carrega o dataset COMPLETO (12 anos) no Supabase Postgres, em 3 granularidades:
//   - public.crime_municipal     agregados anuais por municipio (indicadores municipais)
//   - public.crime_uf            agregados anuais por UF (inclui indicadores so-estaduais)
//   - public.crime_uf_mensal     serie mensal por nivel (BR/UF) e indicador
//
// Faz TRUNCATE de cada tabela antes de inserir, garantindo que a base contem
// EXCLUSIVAMENTE os dados destes ficheiros (sem residuos de cargas anteriores).
//
// Requisitos:
//   npm i pg --no-save
//   export SUPABASE_DB_URL='postgresql://postgres.<ref>:<DB_PASSWORD>@aws-1-<region>.pooler.supabase.com:5432/postgres'
//
// Uso:
//   node scripts/load_postgres_full.mjs
//
// Credenciais SEMPRE do ambiente — nunca hardcoded/committed.
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("Defina SUPABASE_DB_URL (connection string do pooler Supabase).");
  process.exit(1);
}

const OFFICIAL = process.argv[2] ?? "public/officialCrimeData.json.gz";
const TRENDS = process.argv[3] ?? "public/trendsData.json.gz";
const dataset = JSON.parse(gunzipSync(readFileSync(OFFICIAL)).toString("utf-8"));
const trends = JSON.parse(gunzipSync(readFileSync(TRENDS)).toString("utf-8"));

const anoOf = (periodo) => {
  const ano = Number.parseInt(String(periodo ?? "").slice(0, 4), 10);
  if (!Number.isInteger(ano)) throw new Error(`periodo invalido: ${periodo}`);
  return ano;
};

// --- 1) Municipal: uma linha por (municipio, ano, indicador) ---
const munRows = [];
for (const item of dataset.items) {
  const ano = anoOf(item.periodo);
  for (const [indicador, m] of Object.entries(item.indicadores)) {
    munRows.push([
      item.idIbge, item.municipio, item.uf, item.estado ?? null, item.lat ?? null,
      item.lng ?? null, item.populacao ?? null, ano, indicador, m.unidade ?? null,
      m.total ?? 0, m.taxa100k ?? null, m.score ?? null, m.nivel ?? null, m.dataStatus ?? null,
    ]);
  }
}

// --- 2) UF: uma linha por (uf, ano, indicador) ---
const ufRows = (dataset.ufData ?? []).map((r) => [
  r.uf, anoOf(r.periodo), r.indicador, r.unidade ?? null, r.total ?? 0,
  r.taxa100k ?? null, r.variacaoAnual ?? null, r.score ?? null, r.nivel ?? null, r.dataStatus ?? null,
]);

// --- 3) Mensal: explode `valores` (periodo->total) numa linha por mes ---
const mensalRows = [];
for (const s of trends.series ?? []) {
  for (const [mes, valor] of Object.entries(s.valores ?? {})) {
    mensalRows.push([s.nivel, s.indicador, mes, anoOf(mes), valor ?? 0]);
  }
}

const { default: pg } = await import("pg");
const { from: copyFrom } = await import("pg-copy-streams");
const { pipeline } = await import("node:stream/promises");
const { Readable } = await import("node:stream");

// TLS sempre ativo (cifra a DB_PASSWORD em transito). A verificacao da CA fica
// ligada por defeito; SUPABASE_DB_SSL_NO_VERIFY=1 desliga-a apenas para
// ambientes onde a cadeia de CA do pooler nao esta instalada (a ligacao
// continua cifrada, so nao valida o emissor do certificado).
const rejectUnauthorized = process.env.SUPABASE_DB_SSL_NO_VERIFY !== "1";
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized } });
await client.connect();

// O role tem statement_timeout (~2 min) que cancela COPYs grandes a meio.
// Desliga-o nesta sessao (a carga e atomica e supervisionada).
await client.query("set statement_timeout = 0");
await client.query("set idle_in_transaction_session_timeout = 0");

// COPY (formato texto): uma so passagem por tabela em vez de centenas de
// INSERTs — essencial com a latencia de rede ate ao pooler. Campos separados
// por TAB, NULL = \N, com escape de \\ \t \n \r nos textos.
const esc = (v) => {
  if (v === null || v === undefined) return "\\N";
  return String(v)
    .replaceAll("\\", "\\\\")
    .replaceAll("\t", "\\t")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r");
};

async function bulkInsert(table, cols, rows) {
  const t0 = Date.now();
  const stream = client.query(copyFrom(`copy ${table} (${cols.join(",")}) from stdin`));
  // Agrupa milhares de linhas por chunk: com a latencia ate ao pooler, escritas
  // pequenas tornam o COPY lentissimo.
  const source = Readable.from(
    (function* () {
      let buf = [];
      for (const row of rows) {
        buf.push(row.map(esc).join("\t"));
        if (buf.length >= 8000) {
          yield buf.join("\n") + "\n";
          buf = [];
        }
      }
      if (buf.length) yield buf.join("\n") + "\n";
    })(),
  );
  await pipeline(source, stream);
  console.error(`  ${table}: ${rows.length} linhas em ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

// Cada tabela numa transacao propria (truncate+COPY): o load progride de forma
// observavel e uma tabela lenta nao bloqueia as outras. A troca de cada tabela
// continua atomica (truncate e COPY no mesmo begin/commit).
async function loadTable(table, cols, rows) {
  console.error(`-> ${table} (${rows.length} linhas)…`);
  await client.query("begin");
  try {
    await client.query(`truncate ${table}`);
    await bulkInsert(table, cols, rows);
    await client.query("commit");
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  }
}

try {
  await loadTable(
    "public.crime_municipal",
    ["id_ibge", "municipio", "uf", "estado", "lat", "lng", "populacao", "ano", "indicador", "unidade", "valor", "taxa_100k", "score", "nivel", "data_status"],
    munRows,
  );
  await loadTable(
    "public.crime_uf",
    ["uf", "ano", "indicador", "unidade", "valor", "taxa_100k", "variacao_anual", "score", "nivel", "data_status"],
    ufRows,
  );
  await loadTable(
    "public.crime_uf_mensal",
    ["nivel", "indicador", "mes", "ano", "valor"],
    mensalRows,
  );
} catch (err) {
  await client.end();
  throw err;
}

const q = async (sql) => (await client.query(sql)).rows[0];
const m = await q("select count(*) n, count(distinct id_ibge) muns, count(distinct indicador) inds, min(ano) a0, max(ano) a1 from public.crime_municipal");
const u = await q("select count(*) n, count(distinct uf) ufs, count(distinct indicador) inds, min(ano) a0, max(ano) a1 from public.crime_uf");
const me = await q("select count(*) n, count(distinct nivel) niveis, count(distinct indicador) inds, min(mes) m0, max(mes) m1 from public.crime_uf_mensal");
await client.end();

console.log(`crime_municipal: ${m.n} linhas | ${m.muns} municipios | ${m.inds} indicadores | ${m.a0}-${m.a1}`);
console.log(`crime_uf:        ${u.n} linhas | ${u.ufs} UFs | ${u.inds} indicadores | ${u.a0}-${u.a1}`);
console.log(`crime_uf_mensal: ${me.n} linhas | ${me.niveis} niveis | ${me.inds} indicadores | ${me.m0}..${me.m1}`);
