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
import "server-only"; // o asset JSON (~51KB) nunca deve ir para o bundle do cliente
import monthly from "@/data/monthlySeries.json";
import { presencaCrimeOrg, type PresencaCrimeOrg } from "@/server/anomaly/factionPresence";

// Eleições gerais/municipais (out). A janela pré-eleitoral é ago–out do ano do pleito.
export const ELECTION_YEARS = [2016, 2018, 2020, 2022, 2024] as const;
const ELECTION_SET = new Set<number>(ELECTION_YEARS);
const PRE_ELECTION_MONTHS = [8, 9, 10];
// Abaixo desta contagem média mensal, o índice é ruidoso (estados pequenos) —
// marcamos como nao-robusto p/ não superinterpretar oscilação aleatória.
const ROBUST_MIN_MONTHLY = 30;

export type MonthlySeries = Record<string, number>; // "YYYY-MM" -> valor
type SeriesByUf = Record<string, MonthlySeries>;

// Porte da UF por volume mensal de homicídios — para comparar SÓ pares parecidos
// (estado grande com grande), nunca um ranking cru entre UFs heterogêneas (IPEA).
// Cortes derivados da distribuição real (grande≈7, médio≈5, pequeno≈11 UFs).
export type Porte = "grande" | "medio" | "pequeno" | "micro";

export function classifyPorte(mediaMensal: number): Porte {
  if (mediaMensal >= 200) return "grande";
  if (mediaMensal >= 100) return "medio";
  if (mediaMensal >= ROBUST_MIN_MONTHLY) return "pequeno"; // 30..99
  return "micro"; // < 30 -> ruidoso, não-robusto
}

export interface UfElectoralAnomaly {
  uf: string;
  idxEleicao: number | null; // média do índice sazonal (ago-out / média do ano) em anos de eleição
  idxNormal: number | null; // idem em anos normais
  efeito: number | null; // idxEleicao - idxNormal; NEGATIVO = queda pré-eleitoral atípica
  mediaMensal: number; // contagem média mensal (robustez)
  porte: Porte;
  // DiD vs pares: tira do `efeito` da UF o padrão pré-eleitoral COMUM aos pares de
  // mesmo porte (mediana, de qualquer sinal — empiricamente é leve ALTA na maioria
  // dos portes, não uma queda universal). efeitoRelativo NEGATIVO = cai MAIS que os
  // pares — é o sinal de anomalia de verdade (não o movimento comum aos pares).
  efeitoBaseline: number | null; // mediana do efeito dos pares (robustos, mesmo porte)
  efeitoRelativo: number | null; // efeito - efeitoBaseline
  anosEleicao: number;
  anosNormais: number;
  robusto: boolean;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
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
    porte: classifyPorte(mediaMensal),
    efeitoBaseline: null, // preenchido por withPeerBaselines (precisa de toda a população)
    efeitoRelativo: null,
    anosEleicao: idxEleicao.length,
    anosNormais: idxNormal.length,
    robusto: mediaMensal >= ROBUST_MIN_MONTHLY,
  };
}

// Preenche efeitoBaseline/efeitoRelativo (DiD vs pares) — PURO/testável. Para cada
// UF, baseline = mediana do `efeito` dos PARES de mesmo porte (só robustos, exclui
// a própria por UF); com menos de 2 pares, recai na mediana nacional dos robustos
// (controle nacional). efeitoRelativo = efeito - baseline.
export function withPeerBaselines(anomalias: UfElectoralAnomaly[]): UfElectoralAnomaly[] {
  const robusts = anomalias.filter((a) => a.robusto && a.efeito !== null);
  const allMedian = median(robusts.map((a) => a.efeito as number));
  return anomalias.map((a) => {
    if (a.efeito === null) return { ...a, efeitoBaseline: null, efeitoRelativo: null };
    const peers = robusts.filter((p) => p.porte === a.porte && p.uf !== a.uf).map((p) => p.efeito as number);
    const base = peers.length >= 2 ? median(peers) : allMedian; // poucos pares -> controle nacional
    return {
      ...a,
      efeitoBaseline: base === null ? null : round3(base),
      efeitoRelativo: base === null ? null : round3(a.efeito - base),
    };
  });
}

// UFs ordenadas pela queda pré-eleitoral RELATIVA AOS PARES (efeitoRelativo, mais
// negativo primeiro) — DiD vs pares de mesmo porte, não ranking cru do efeito bruto.
// BR fica fora (é o agregado nacional — referência, não unidade de análise).
export function getElectoralAnomalies(): UfElectoralAnomaly[] {
  const series = (monthly as { series: SeriesByUf }).series;
  if (!series) throw new Error("monthlySeries.json: estrutura inválida (faltou 'series')");
  const anomalias = Object.keys(series)
    .filter((uf) => uf !== "BR")
    .map((uf) => computeUfAnomaly(uf, series[uf]))
    .filter((a) => a.efeito !== null);
  return withPeerBaselines(anomalias).sort(
    (a, b) => (a.efeitoRelativo ?? 0) - (b.efeitoRelativo ?? 0),
  );
}

export const INDICADOR = (monthly as { indicador: string }).indicador;

// Limiar de queda relativa aos pares para um sinal ser considerado relevante.
// Calibrado como ~1 desvio robusto abaixo da mediana dos pares: empiricamente a
// distribuição do efeitoRelativo tem mediana ~+0,005 e MAD ~0,030 (1,4826·MAD ≈
// 0,044), então -0,05 funciona como um corte de outlier de ~1σ. Knob ajustável.
export const EFEITO_RELATIVO_LIMIAR = -0.05;

// Sinal final da lente eleitoral, CRUZADO com presença de facção (#85, princípio
// central). A queda relativa só vira "forte" quando há crime organizado na UF
// (≥1 facção nacional); sem presença documentada, fica "isolado" (não promovido —
// mais provável causa benigna). Abaixo do limiar: "sem desvio"; sem robustez:
// "baixa amostra".
export type SinalEleitoral = "baixa_amostra" | "sem_desvio" | "forte" | "isolado";

export function classifySinal(
  uf: string,
  efeitoRelativo: number | null,
  robusto: boolean,
): { sinal: SinalEleitoral; presenca: PresencaCrimeOrg } {
  const presenca = presencaCrimeOrg(uf);
  if (!robusto) return { sinal: "baixa_amostra", presenca };
  if (efeitoRelativo === null || efeitoRelativo > EFEITO_RELATIVO_LIMIAR) {
    return { sinal: "sem_desvio", presenca };
  }
  return { sinal: presenca === "baixa" ? "isolado" : "forte", presenca };
}
