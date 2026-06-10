import type { CrimeIndicatorKey, MunicipalityCrimeData, ViewMode } from "@/types/crime";
import { getMetricValue } from "@/lib/crimeMetrics";

export type RankingOrder = "desc" | "asc";

// Ranking por indicador/modo. `order`:
// - "desc" (piores): maiores valores primeiro (comportamento historico).
// - "asc" (melhores): menores valores primeiro; empates (ex.: muitos municipios
//   com 0 casos) sao desempatados por populacao DESCENDENTE, para que os
//   melhores listados sejam os locais maiores — mais informativos do que
//   aldeias minusculas com zero estatistico.
export function getRankedMunicipalities(
  data: MunicipalityCrimeData[],
  indicator: CrimeIndicatorKey,
  viewMode: ViewMode,
  uf?: string | null,
  limit = 10,
  order: RankingOrder = "desc",
): MunicipalityCrimeData[] {
  const filtered = uf ? data.filter((item) => item.uf === uf) : data;
  return filtered
    .filter((item) => Number.isFinite(getMetricValue(item, indicator, viewMode)))
    .sort((a, b) => {
      const va = getMetricValue(a, indicator, viewMode);
      const vb = getMetricValue(b, indicator, viewMode);
      if (va !== vb) {
        return order === "desc" ? vb - va : va - vb;
      }
      return order === "asc" ? (b.populacao ?? 0) - (a.populacao ?? 0) : 0;
    })
    .slice(0, limit);
}

export function getMunicipalityRank(
  data: MunicipalityCrimeData[],
  municipalityId: string,
  indicator: CrimeIndicatorKey,
  viewMode: ViewMode,
  uf?: string | null,
): number {
  const ranked = getRankedMunicipalities(data, indicator, viewMode, uf, data.length);
  return ranked.findIndex((item) => item.idIbge === municipalityId) + 1;
}
