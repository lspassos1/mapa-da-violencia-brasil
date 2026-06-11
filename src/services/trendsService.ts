// Carrega o dataset de tendencias mensais (public/trendsData.json.gz):
// series agregadas por nivel ("BR" ou UF) e indicador, com totais "YYYY-MM".
// Gerado por `python3 -m etl.aggregate_vde build-trends`. Servido gzipado e
// descomprimido no cliente com DecompressionStream (mesmo requisito da carga
// principal); cacheado a nivel de modulo.

export interface TrendsSeries {
  nivel: string; // "BR" ou sigla da UF
  indicador: string;
  valores: Record<string, number>; // "YYYY-MM" -> total
}

export interface TrendsData {
  updatedAt: string;
  source: string;
  partialYears: number[];
  series: TrendsSeries[];
}

const EMPTY: TrendsData = { updatedAt: "", source: "", partialYears: [], series: [] };

let trendsPromise: Promise<TrendsData> | null = null;

export function loadTrendsData(): Promise<TrendsData> {
  if (trendsPromise) {
    return trendsPromise;
  }
  if (typeof DecompressionStream === "undefined") {
    if (typeof console !== "undefined") {
      console.warn("[trendsService] DecompressionStream indisponivel neste navegador.");
    }
    return Promise.resolve(EMPTY);
  }
  trendsPromise = fetch("/trendsData.json.gz")
    .then(async (response) => {
      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }
      const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
      return (await new Response(stream).json()) as TrendsData;
    })
    .catch((error) => {
      if (typeof console !== "undefined") {
        console.warn(`[trendsService] Falha ao carregar trendsData: ${String(error)}.`);
      }
      trendsPromise = null; // permite nova tentativa
      return EMPTY;
    });
  return trendsPromise;
}
