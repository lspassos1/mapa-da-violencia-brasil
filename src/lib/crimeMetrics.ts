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

