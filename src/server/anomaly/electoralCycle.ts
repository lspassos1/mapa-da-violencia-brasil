// Radar de anomalia — LENTE ELEITORAL (#85, eixo 1).
// Detecta queda atípica do homicídio na janela PRÉ-ELEIÇÃO (ago–out, eleições em
// outubro) em anos de eleição vs. anos normais, comparando cada UF CONSIGO MESMA
// (índice sazonal intra-UF) — desenho que evita a heterogeneidade de definição
// entre estados (IPEA) e não faz ranking cru entre UFs.
//
// IMPORTANTE: isto é DETECÇÃO, não prova. Um efeito negativo é INDÍCIO para
// investigar (pode ser operação policial real, mudança de notificação,
// subnotificação/manipulação ou coincidência) — nunca acusação. Ver §literatura
// no issue #85 (o ciclo só costuma aparecer onde há crime organizado).
import monthly from "@/data/monthlySeries.json";

// Eleições gerais/municipais (out). A janela pré-eleitoral é ago–out do ano do pleito.
export const ELECTION_YEARS = [2016, 2018, 2020, 2022, 2024] as const;
const ELECTION_SET = new Set<number>(ELECTION_YEARS);
const PRE_ELECTION_MONTHS = [8, 9, 10];
// Abaixo desta contagem média mensal, o índice é ruidoso (estados pequenos) —
// marcamos como nao-robusto p/ não superinterpretar oscilação aleatória.
const ROBUST_MIN_MONTHLY = 30;

export type MonthlySeries = Record<string, number>; // "YYYY-MM" -> valor
type SeriesByUf = Record<string, MonthlySeries>;

export interface UfElectoralAnomaly {
  uf: string;
  idxEleicao: number | null; // média do índice sazonal (ago-out / média do ano) em anos de eleição
  idxNormal: number | null; // idem em anos normais
  efeito: number | null; // idxEleicao - idxNormal; NEGATIVO = queda pré-eleitoral atípica
  mediaMensal: number; // contagem média mensal (robustez)
  anosEleicao: number;
  anosNormais: number;
  robusto: boolean;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
const round3 = (n: number) => Math.round(n * 1000) / 1000;

// Agrupa a série por ano -> valores por mês (índice 1..12).
function byYear(serie: MonthlySeries): Map<number, Map<number, number>> {
  const out = new Map<number, Map<number, number>>();
  for (const [ym, valor] of Object.entries(serie)) {
    const [y, m] = ym.split("-").map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m)) continue;
    if (!out.has(y)) out.set(y, new Map());
    out.get(y)!.set(m, valor);
  }
  return out;
}

// Calcula a anomalia eleitoral de UMA UF a partir da sua série mensal.
export function computeUfAnomaly(uf: string, serie: MonthlySeries): UfElectoralAnomaly {
  const grouped = byYear(serie);
  const idxEleicao: number[] = [];
  const idxNormal: number[] = [];
  let soma = 0;
  let nMeses = 0;

  for (const [ano, meses] of grouped) {
    if (ano > 2025) continue; // ano parcial (ex.: 2026) não entra
    const todos: number[] = [];
    for (let m = 1; m <= 12; m++) {
      const v = meses.get(m);
      if (typeof v === "number") todos.push(v);
    }
    if (todos.length < 12) continue; // só anos completos
    const mediaAno = mean(todos);
    if (mediaAno <= 0) continue;
    const pre = PRE_ELECTION_MONTHS.map((m) => meses.get(m)).filter((v): v is number => typeof v === "number");
    if (pre.length < PRE_ELECTION_MONTHS.length) continue;
    const indice = mean(pre) / mediaAno;
    (ELECTION_SET.has(ano) ? idxEleicao : idxNormal).push(indice);
    soma += todos.reduce((a, b) => a + b, 0);
    nMeses += 12;
  }

  const mediaMensal = nMeses ? soma / nMeses : 0;
  const ie = idxEleicao.length ? mean(idxEleicao) : null;
  const inr = idxNormal.length ? mean(idxNormal) : null;
  const efeito = ie !== null && inr !== null ? ie - inr : null;

  return {
    uf,
    idxEleicao: ie === null ? null : round3(ie),
    idxNormal: inr === null ? null : round3(inr),
    efeito: efeito === null ? null : round3(efeito),
    mediaMensal: Math.round(mediaMensal),
    anosEleicao: idxEleicao.length,
    anosNormais: idxNormal.length,
    robusto: mediaMensal >= ROBUST_MIN_MONTHLY,
  };
}

// Ranking das UFs por queda pré-eleitoral (mais negativo primeiro). BR fica fora
// (é o agregado nacional — referência, não unidade de análise).
export function getElectoralAnomalies(): UfElectoralAnomaly[] {
  const series = (monthly as { series: SeriesByUf }).series;
  return Object.keys(series)
    .filter((uf) => uf !== "BR")
    .map((uf) => computeUfAnomaly(uf, series[uf]))
    .filter((a) => a.efeito !== null)
    .sort((a, b) => (a.efeito as number) - (b.efeito as number));
}

export const INDICADOR = (monthly as { indicador: string }).indicador;
