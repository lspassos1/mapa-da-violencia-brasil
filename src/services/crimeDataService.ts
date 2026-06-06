import { demoDataStatus, indicatorOptions, mockCrimeData, periodOptions } from "@/data/mockCrimeData";
import officialNationalDataset from "@/data/officialCrimeData.json";
import officialSampleDataset from "@/data/officialCrimeData.sample.json";
import { CRIME_DATA_MODE } from "@/lib/dataMode";
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

const dataMode = CRIME_DATA_MODE;
// Seleciona o dataset oficial conforme o modo: carga nacional (`official`) ou
// amostra versionada (`official_sample`). Em `demo` usa o mock.
//
// NOTA DE TAMANHO: officialCrimeData.json (versionado como placeholder vazio) e
// importado estaticamente, logo entra no bundle em qualquer modo. Mantenha-o
// pequeno. Para uma carga nacional grande, sirva o JSON de `public/` via fetch
// em vez de o committar aqui (ver docs/CARGA_NACIONAL.md) — evita inflar os
// bundles de demo/official_sample.
const officialData = (dataMode === "official" ? officialNationalDataset : officialSampleDataset) as OfficialCrimeDataset;

if (dataMode === "official" && officialData.items.length === 0 && typeof console !== "undefined") {
  console.warn(
    "[crimeDataService] Modo 'official' ativo mas a carga nacional esta vazia (placeholder). " +
      "Gere os dados com scripts/build_national_dataset.sh (ver docs/CARGA_NACIONAL.md).",
  );
}

const activeIndicators = dataMode === "demo" ? indicatorOptions : officialData.indicators;
const activePeriods = dataMode === "demo" ? periodOptions : officialData.periods;
const activeData = dataMode === "demo" ? mockCrimeData : officialData.items;
const activeStatus: DataStatus = dataMode === "demo" ? demoDataStatus : officialData.status;
const activeViewModes = getAvailableViewModes();

const defaultIndicator = activeIndicators[0]?.key ?? "homicidioDoloso";
const defaultPeriod = activePeriods[0]?.key ?? "2018-03";

// So abre na vista de taxa por 100 mil quando existe pelo menos um valor real no
// periodo que abre por omissao; com a taxa suprimida (ex.: populacao de ano
// diferente) o app abre na vista de indice (score) para nao mostrar um mapa
// inteiramente "Indisponivel". Restrito ao periodo padrao para que, com dados
// multi-vintage, a escolha reflita apenas o periodo efetivamente exibido.
const defaultPeriodHasTaxaData = activeData.some(
  (item) =>
    item.periodo === defaultPeriod &&
    Object.values(item.indicadores).some((metric) => typeof metric?.taxa100k === "number"),
);

const defaultFilters: CrimeMapFilters = {
  indicator: defaultIndicator,
  period: defaultPeriod,
  viewMode:
    defaultPeriodHasTaxaData &&
    activeViewModes.some((option) => option.key === "taxa100k") &&
    dataMode !== "demo"
      ? "taxa100k"
      : "score",
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
    viewModes: [...activeViewModes],
    ufs: getAvailableUfs(),
    defaultFilters: getDefaultCrimeMapFilters(),
    dataMode,
    scope: getDataScope(),
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
  return activeViewModes.some((option) => option.key === value);
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

function getAvailableViewModes(): CrimeMetadata["viewModes"] {
  const options: CrimeMetadata["viewModes"] = [
    { key: "score", label: "Indice 0-100" },
    { key: "total", label: getTotalViewLabel() },
    { key: "taxa100k", label: "Taxa por 100 mil" },
  ];

  if (hasVariationSeries()) {
    options.push({ key: "variacaoMensal", label: "Variacao mensal" });
  }

  return options;
}

function getTotalViewLabel(): string {
  if (activeStatus.unit === "vitimas") {
    return "Total de vitimas";
  }
  if (activeStatus.unit === "ocorrencias") {
    return "Total de ocorrencias";
  }
  return "Total";
}

function getDataScope(): CrimeMetadata["scope"] {
  return {
    items: activeData.length,
    municipalities: new Set(activeData.map((item) => item.idIbge)).size,
    ufs: getAvailableUfs().length,
    indicators: activeIndicators.length,
    periods: activePeriods.length,
    hasVariationSeries: hasVariationSeries(),
    unit: activeStatus.unit,
  };
}

function hasVariationSeries(): boolean {
  return activeData.some((item) =>
    Object.values(item.indicadores).some((metric) => typeof metric?.variacaoMensal === "number"),
  );
}
