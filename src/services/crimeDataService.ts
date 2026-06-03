import { demoDataStatus, indicatorOptions, mockCrimeData, periodOptions } from "@/data/mockCrimeData";
import officialCrimeDataset from "@/data/officialCrimeData.sample.json";
import { getRankedMunicipalities } from "@/lib/ranking";
import type {
  CrimeMetadata,
  CrimeIndicatorKey,
  CrimeMapFilters,
  CrimeMapResult,
  DataStatus,
  IndicatorOption,
  MunicipalityCrimeData,
  PeriodOption,
  ViewMode,
} from "@/types/crime";

interface OfficialCrimeDataset {
  status: DataStatus;
  indicators: IndicatorOption[];
  periods: PeriodOption[];
  items: MunicipalityCrimeData[];
}

const officialData = officialCrimeDataset as OfficialCrimeDataset;
const viewModeOptions: CrimeMetadata["viewModes"] = [
  { key: "score", label: "Indice 0-100" },
  { key: "total", label: "Total" },
  { key: "taxa100k", label: "Taxa por 100 mil" },
  { key: "variacaoMensal", label: "Variacao mensal" },
];
const dataMode = process.env.NEXT_PUBLIC_CRIME_DATA_MODE === "official_sample" ? "official_sample" : "demo";
const activeIndicators = dataMode === "demo" ? indicatorOptions : officialData.indicators;
const activePeriods = dataMode === "demo" ? periodOptions : officialData.periods;
const activeData = dataMode === "demo" ? mockCrimeData : officialData.items;
const activeStatus: DataStatus = dataMode === "demo" ? demoDataStatus : officialData.status;

const defaultFilters: CrimeMapFilters = {
  indicator: activeIndicators[0]?.key ?? "homicidioDoloso",
  period: activePeriods[0]?.key ?? "2018-03",
  viewMode: dataMode === "demo" ? "score" : "taxa100k",
  uf: null,
};

export function getDefaultCrimeMapFilters(): CrimeMapFilters {
  return { ...defaultFilters };
}

export function getAvailableIndicators(): IndicatorOption[] {
  return [...activeIndicators];
}

export function getAvailablePeriods(): PeriodOption[] {
  return [...activePeriods];
}

export function getDemoDataStatus(): DataStatus {
  return activeStatus;
}

export function getCrimeMetadata(): CrimeMetadata {
  return {
    indicators: getAvailableIndicators(),
    periods: getAvailablePeriods(),
    viewModes: [...viewModeOptions],
    ufs: getAvailableUfs(),
    defaultFilters: getDefaultCrimeMapFilters(),
    dataMode,
  };
}

export function getCrimeMapData(filters: Partial<CrimeMapFilters> = {}): CrimeMapResult {
  const resolved = resolveFilters(filters);
  const items = activeData.filter(
    (item) => item.periodo === resolved.period && (!resolved.uf || item.uf === resolved.uf),
  );

  return {
    demo: dataMode === "demo",
    status: activeStatus,
    filters: resolved,
    items,
    ranking: getRankedMunicipalities(items, resolved.indicator, resolved.viewMode, null, 10),
    metadata: getCrimeMetadata(),
  };
}

export function getMunicipalityById(idIbge: string, period = defaultFilters.period): MunicipalityCrimeData | null {
  return activeData.find((municipality) => municipality.idIbge === idIbge && municipality.periodo === period) ?? null;
}

export function isCrimeIndicatorKey(value: string): value is CrimeIndicatorKey {
  return activeIndicators.some((option) => option.key === value);
}

export function isViewMode(value: string): value is ViewMode {
  return ["score", "total", "taxa100k", "variacaoMensal"].includes(value);
}

function resolveFilters(filters: Partial<CrimeMapFilters>): CrimeMapFilters {
  const indicator = filters.indicator && isCrimeIndicatorKey(filters.indicator)
    ? filters.indicator
    : defaultFilters.indicator;
  const viewMode = filters.viewMode && isViewMode(filters.viewMode)
    ? filters.viewMode
    : defaultFilters.viewMode;
  return {
    indicator,
    period: filters.period ?? defaultFilters.period,
    viewMode,
    uf: filters.uf ? filters.uf.toUpperCase() : defaultFilters.uf,
  };
}

function getAvailableUfs(): CrimeMetadata["ufs"] {
  const byUf = new Map<string, string>();
  for (const item of activeData) {
    byUf.set(item.uf, item.estado);
  }
  return Array.from(byUf, ([uf, nome]) => ({ uf, nome })).sort((a, b) => a.uf.localeCompare(b.uf));
}
