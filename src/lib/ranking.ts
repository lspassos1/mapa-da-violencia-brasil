import type { CrimeIndicatorKey, MunicipalityCrimeData, ViewMode } from "@/types/crime";

export function getMetricValue(
  item: MunicipalityCrimeData,
  indicator: CrimeIndicatorKey,
  viewMode: ViewMode,
): number {
  const metric = item.indicadores[indicator];
  if (viewMode === "total") return metric.total;
  if (viewMode === "taxa100k") return metric.taxa100k;
  if (viewMode === "variacaoMensal") return metric.variacaoMensal;
  return metric.score;
}

export function getRankedMunicipalities(
  data: MunicipalityCrimeData[],
  indicator: CrimeIndicatorKey,
  viewMode: ViewMode,
  uf?: string | null,
  limit = 10,
): MunicipalityCrimeData[] {
  const filtered = uf ? data.filter((item) => item.uf === uf) : data;
  return [...filtered]
    .sort((a, b) => getMetricValue(b, indicator, viewMode) - getMetricValue(a, indicator, viewMode))
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

