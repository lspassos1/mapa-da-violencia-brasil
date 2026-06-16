// Gera src/data/rjIspCrime.json a partir da base mensal por município/CISP do
// ISP-RJ (ISPdados). Asset estático bundleado — o "mercado criminal" da lente 2
// (#85): letalidade, tráfico, extorsão (assinatura de milícia) e desaparecidos.
//
// Uso: `node scripts/build_rj_isp.mjs` (baixa o CSV público; sem credenciais).
import { writeFileSync } from "node:fs";

const URL = "https://www.ispdados.rj.gov.br/Arquivos/BaseDPEvolucaoMensalCisp.csv";
// indicadores que importam p/ a lente 2 (nome no CSV -> chave no asset)
const COLS = {
  letalidade_violenta: "letalidade",
  trafico_drogas: "trafico",
  extorsao: "extorsao",
  pessoas_desaparecidas: "desaparecidos",
  total_roubos: "roubos",
};

const res = await fetch(URL, { signal: AbortSignal.timeout(60000) });
if (!res.ok) throw new Error(`ISPdados HTTP ${res.status}`);
const csv = new TextDecoder("latin1").decode(await res.arrayBuffer());

const lines = csv.split(/\r?\n/).filter((l) => l.trim());
const header = lines[0].split(";").map((c) => c.replace(/^"|"$/g, "").trim());
const idx = (name) => header.indexOf(name);
const iAno = idx("ano");
const iMunic = idx("munic");
const inds = Object.entries(COLS).map(([col, key]) => [idx(col), key]).filter(([i]) => i >= 0);
if (iAno < 0 || iMunic < 0) throw new Error("colunas ano/munic não encontradas no CSV");

const num = (s) => {
  const n = parseInt((s || "").replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};

// munic -> ano -> { letalidade, trafico, extorsao, desaparecidos, roubos }
const series = {};
for (let r = 1; r < lines.length; r++) {
  const f = lines[r].split(";").map((c) => c.replace(/^"|"$/g, "").trim());
  const munic = f[iMunic];
  const ano = f[iAno];
  if (!munic || !/^\d{4}$/.test(ano)) continue;
  const bucket = ((series[munic] ??= {})[ano] ??= { letalidade: 0, trafico: 0, extorsao: 0, desaparecidos: 0, roubos: 0 });
  for (const [i, key] of inds) bucket[key] += num(f[i]);
}

const out = "src/data/rjIspCrime.json";
writeFileSync(out, JSON.stringify({ fonte: "ISP-RJ (ISPdados)", uf: "RJ", series }) + "\n");
console.log(`OK — ${Object.keys(series).length} municípios → ${out}`);
