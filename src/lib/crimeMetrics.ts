import type { CrimeIndicatorKey, CrimeMetric, MunicipalityCrimeData, ViewMode } from "@/types/crime";

export function getMetricValue(
  item: MunicipalityCrimeData,
  indicator: CrimeIndicatorKey,
  viewMode: ViewMode,
): number {
  const metric = item.indicadores[indicator];
  return getMetricValueFromMetric(metric, viewMode);
}

export function getMetricValueFromMetric(metric: CrimeMetric, viewMode: ViewMode): number {
  if (viewMode === "total") return metric.total;
  if (viewMode === "taxa100k") return metric.taxa100k;
  if (viewMode === "variacaoMensal") return metric.variacaoMensal;
  return metric.score;
}
