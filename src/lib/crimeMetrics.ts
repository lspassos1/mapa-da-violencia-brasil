import type { CrimeIndicatorKey, CrimeMetric, MunicipalityCrimeData, ViewMode } from "@/types/crime";

export function getMetricValue(
  item: MunicipalityCrimeData,
  indicator: CrimeIndicatorKey,
  viewMode: ViewMode,
): number {
  const metric = item.indicadores[indicator];
  if (!metric || metric.dataStatus === "sem_dados" || metric.dataStatus === "nao_aplicavel") {
    return Number.NEGATIVE_INFINITY;
  }
  return getMetricValueFromMetric(metric, viewMode);
}

export function getMetricValueFromMetric(metric: CrimeMetric, viewMode: ViewMode): number {
  if (viewMode === "total") return metric.total;
  if (viewMode === "taxa100k") return metric.taxa100k ?? Number.NEGATIVE_INFINITY;
  if (viewMode === "variacaoMensal") return metric.variacaoMensal ?? Number.NEGATIVE_INFINITY;
  if (viewMode === "variacaoAnual") return metric.variacaoAnual ?? Number.NEGATIVE_INFINITY;
  return metric.score;
}
