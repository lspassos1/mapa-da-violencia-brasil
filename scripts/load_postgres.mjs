#!/usr/bin/env node
// Carrega um dataset app-ready (gzipped) na tabela public.crime_municipal do
// Supabase Postgres. Uma linha por (municipio, ano, indicador).
//
// Requisitos:
//   npm i pg --no-save        # cliente Postgres (nao e dependencia do projeto)
//   export SUPABASE_DB_URL='postgresql://postgres.<ref>:<DB_PASSWORD>@aws-1-<region>.pooler.supabase.com:5432/postgres'
//
// Uso:
//   node scripts/load_postgres.mjs [ficheiro.json.gz]
//
// Credenciais SEMPRE do ambiente — nunca hardcoded/committed.
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("Defina SUPABASE_DB_URL (connection string do pooler Supabase).");
  process.exit(1);
}

const file = process.argv[2] ?? "public/officialCrimeData.json.gz";
const dataset = JSON.parse(gunzipSync(readFileSync(file)).toString("utf-8"));

// Suporta carga anual e multi-ano: o ano de cada linha vem do `periodo` do
// proprio item ("YYYY"), nao de um unico periods[0]. Reescreve todos os anos
// presentes no dataset.
const rows = [];
const anos = new Set();
for (const item of dataset.items) {
  const ano = Number.parseInt(String(item.periodo ?? "").slice(0, 4), 10);
  if (!Number.isInteger(ano)) {
    console.error(`Item ${item.idIbge} sem periodo anual valido (periodo=${item.periodo}).`);
    process.exit(1);
  }
  anos.add(ano);
  for (const [indicador, metric] of Object.entries(item.indicadores)) {
    rows.push([
      item.idIbge, item.municipio, item.uf, item.estado, item.lat, item.lng,
      item.populacao, ano, indicador, metric.unidade ?? null, metric.total ?? 0,
      metric.taxa100k ?? null, metric.score ?? null, metric.nivel ?? null,
      metric.dataStatus ?? null,
    ]);
  }
}
const anosList = [...anos].sort((a, b) => a - b);

const { default: pg } = await import("pg");
// TLS com verificacao do certificado (o pooler Supabase apresenta um cert
// assinado por CA publica). Nunca desativar a validacao: protege a DB_PASSWORD.
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: true } });
await client.connect();

const COLS = 15;
try {
  // Delete + todos os inserts numa unica transacao: a troca dos anos presentes
  // e atomica e instantanea (nenhuma query de BI ve zero linhas a meio da carga).
  await client.query("begin");
  await client.query("delete from public.crime_municipal where ano = any($1::int[])", [anosList]);

  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const values = [];
    const placeholders = chunk.map((row, j) => {
      values.push(...row);
      return "(" + Array.from({ length: COLS }, (_, k) => `$${j * COLS + k + 1}`).join(",") + ")";
    });
    await client.query(
      `insert into public.crime_municipal
         (id_ibge,municipio,uf,estado,lat,lng,populacao,ano,indicador,unidade,valor,taxa_100k,score,nivel,data_status)
       values ${placeholders.join(",")}
       on conflict (id_ibge,ano,indicador) do update set
         valor=excluded.valor, taxa_100k=excluded.taxa_100k, score=excluded.score,
         nivel=excluded.nivel, data_status=excluded.data_status`,
      values,
    );
  }

  await client.query("commit");

  const { rows: [summary] } = await client.query(
    "select count(*) n, count(distinct id_ibge) municipios, count(distinct indicador) indicadores, count(distinct ano) anos from public.crime_municipal where ano = any($1::int[])",
    [anosList],
  );
  const span = anosList.length === 1 ? `${anosList[0]}` : `${anosList[0]}-${anosList[anosList.length - 1]}`;
  console.log(`Anos ${span}: ${summary.n} linhas (${summary.municipios} municipios, ${summary.indicadores} indicadores, ${summary.anos} anos).`);
} catch (err) {
  await client.query("rollback").catch(() => {});
  throw err;
} finally {
  await client.end();
}
