import { demoDataStatus, indicatorOptions, mockCrimeData, periodOptions } from "@/data/mockCrimeData";
import { getRankedMunicipalities } from "@/lib/ranking";
import type {
  CrimeIndicatorKey,
  CrimeMapFilters,
  CrimeMapResult,
  IndicatorOption,
  MunicipalityCrimeData,
  PeriodOption,
  ViewMode,
} from "@/types/crime";

const defaultFilters: CrimeMapFilters = {
  indicator: "indiceGeral",
  period: periodOptions[0].key,
  viewMode: "score",
  uf: null,
};

export function getDefaultCrimeMapFilters(): CrimeMapFilters {
  return { ...defaultFilters };
}

export function getAvailableIndicators(): IndicatorOption[] {
  return [...indicatorOptions];
}

export function getAvailablePeriods(): PeriodOption[] {
  return [...periodOptions];
}

export function getDemoDataStatus() {
  return demoDataStatus;
}

export function getCrimeMapData(filters: Partial<CrimeMapFilters> = {}): CrimeMapResult {
  const resolved = resolveFilters(filters);
  const items = mockCrimeData.filter(
    (item) => item.periodo === resolved.period && (!resolved.uf || item.uf === resolved.uf),
  );

  return {
    demo: true,
    status: demoDataStatus,
    filters: resolved,
    items,
    ranking: getRankedMunicipalities(items, resolved.indicator, resolved.viewMode, null, 10),
  };
}

export function getMunicipalityById(idIbge: string, period = defaultFilters.period): MunicipalityCrimeData | null {
  return mockCrimeData.find((municipality) => municipality.idIbge === idIbge && municipality.periodo === period) ?? null;
}

export function isCrimeIndicatorKey(value: string): value is CrimeIndicatorKey {
  return indicatorOptions.some((option) => option.key === value);
}

export function isViewMode(value: string): value is ViewMode {
  return ["score", "total", "taxa100k", "variacaoMensal"].includes(value);
}

function resolveFilters(filters: Partial<CrimeMapFilters>): CrimeMapFilters {
  return {
    indicator: filters.indicator ?? defaultFilters.indicator,
    period: filters.period ?? defaultFilters.period,
    viewMode: filters.viewMode ?? defaultFilters.viewMode,
    uf: filters.uf ? filters.uf.toUpperCase() : defaultFilters.uf,
  };
}
