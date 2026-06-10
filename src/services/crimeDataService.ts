import { demoDataStatus, indicatorOptions, mockCrimeData, periodOptions } from "@/data/mockCrimeData";
import officialSampleDataset from "@/data/officialCrimeData.sample.json";
import { CRIME_DATA_MODE, isRemoteDataMode, type CrimeDataMode } from "@/lib/dataMode";
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
  UfDatum,
  ViewMode,
} from "@/types/crime";

// Caminho público (relativo à raiz do site) onde a carga nacional `official` e
// servida como asset estatico. NAO e importada estaticamente: e carregada via
// fetch (cliente) ou filesystem (servidor) apenas no modo `official`, para que o
// JSON nacional (potencialmente varios MB) fique FORA dos bundles de
// demo/official_sample. Ver docs/CARGA_NACIONAL.md.
export const OFFICIAL_DATASET_PUBLIC_PATH = "/officialCrimeData.json.gz";

// Em modo `supabase`, a carga e servida do Supabase Storage (bucket publico
// `crime-data`). Vazio quando NEXT_PUBLIC_SUPABASE_URL nao esta configurado —
// assim o loader deteta a configuracao em falta e avisa, em vez de tentar uma
// URL relativa (que falharia silenciosamente).
const SUPABASE_BASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_DATASET_URL = SUPABASE_BASE_URL
  ? `${SUPABASE_BASE_URL}/storage/v1/object/public/crime-data/current.json.gz`
  : "";

// URL da carga oficial conforme o modo: asset estatico local (`official`) ou
// Supabase Storage (`supabase`). String vazia se a config do Supabase falta.
export function officialDatasetUrl(mode: CrimeDataMode = CRIME_DATA_MODE): string {
  return mode === "supabase" ? SUPABASE_DATASET_URL : OFFICIAL_DATASET_PUBLIC_PATH;
}

export interface OfficialCrimeDataset {
  status: DataStatus;
  indicators: IndicatorOption[];
  periods: PeriodOption[];
  items: MunicipalityCrimeData[];
  // Indicadores so-UF (patrimoniais/sexuais): um registo por (uf, periodo, indicador).
  ufData?: UfDatum[];
}

// Superficie sincrona do servico de dados: as funcoes consumidas pelo dashboard
// e pelas rotas de API. Produzida por createCrimeDataApi a partir de um dataset
// ja resolvido (estatico para demo/official_sample, carregado para official).
export interface CrimeDataApi {
  getDefaultCrimeMapFilters(): CrimeMapFilters;
  getAvailableIndicators(): IndicatorOption[];
  getAvailablePeriods(): PeriodOption[];
  getDemoDataStatus(): DataStatus;
  getCrimeMetadata(): CrimeMetadata;
  getCrimeMapData(filters?: Partial<CrimeMapFilters>): CrimeMapResult;
  getMunicipalityById(idIbge: string, period?: string): MunicipalityCrimeData | null;
  isCrimeIndicatorKey(value: string): value is CrimeIndicatorKey;
  isViewMode(value: string): value is ViewMode;
  // Indicadores so-UF (degrade nacional dos estados; sem detalhe municipal).
  isUfIndicator(indicator: CrimeIndicatorKey): boolean;
  getUfChoropleth(period: string, indicator: CrimeIndicatorKey): UfDatum[];
  getUfDatum(uf: string, period: string, indicator: CrimeIndicatorKey): UfDatum | null;
  // Todos os registos estaduais de um indicador (todas as UFs x periodos) —
  // alimenta a comparacao entre estados e as series temporais por UF.
  getUfIndicatorData(indicator: CrimeIndicatorKey): UfDatum[];
}

// Placeholder do modo `official` enquanto a carga nacional nao for gerada. Antes
// vivia em src/data/officialCrimeData.json (importado estaticamente); agora e
// inline para evitar qualquer import do JSON nacional nos bundles. O asset real
// fica em public/officialCrimeData.json (gerado por scripts/build_national_dataset.sh).
export const EMPTY_OFFICIAL_DATASET: OfficialCrimeDataset = {
  status: {
    source: "MJSP/SINESP",
    lastUpdated: "",
    latestPeriod: "",
    status: "Carga nacional nao gerada",
    mode: "official",
    sourceId: "sinesp_municipios",
    unit: "vitimas",
    limitations: [
      "Placeholder: a carga nacional oficial ainda nao foi gerada. Execute scripts/build_national_dataset.sh e publique o resultado em public/officialCrimeData.json (ver docs/CARGA_NACIONAL.md).",
    ],
  },
  indicators: [],
  periods: [],
  items: [],
};

// Dataset demonstrativo, derivado dos mocks, no mesmo formato dos datasets
// oficiais para que createCrimeDataApi trate os tres modos de forma uniforme.
const DEMO_DATASET: OfficialCrimeDataset = {
  status: demoDataStatus,
  indicators: indicatorOptions,
  periods: periodOptions,
  items: mockCrimeData,
};

const OFFICIAL_SAMPLE_DATASET = officialSampleDataset as OfficialCrimeDataset;

// Dataset disponivel SINCRONAMENTE em tempo de carregamento do modulo: real para
// demo/official_sample; placeholder vazio para official (a carga real e injetada
// depois, via loader assincrono no cliente ou leitura de filesystem no servidor).
export function getStaticDataset(mode: CrimeDataMode = CRIME_DATA_MODE): OfficialCrimeDataset {
  if (mode === "demo") {
    return DEMO_DATASET;
  }
  if (mode === "official_sample") {
    return OFFICIAL_SAMPLE_DATASET;
  }
  return EMPTY_OFFICIAL_DATASET;
}

// Fabrica pura: dado um modo e um dataset ja resolvido, devolve a API sincrona.
// Nao importa JSON nem toca em filesystem/rede, por isso e segura no cliente.
export function createCrimeDataApi(mode: CrimeDataMode, dataset: OfficialCrimeDataset): CrimeDataApi {
  const activeIndicators = dataset.indicators;
  const activePeriods = dataset.periods;
  const activeData = dataset.items;
  const activeUfData = dataset.ufData ?? [];
  const ufIndicatorKeys = new Set(
    activeIndicators.filter((option) => option.nivelDado === "uf").map((option) => option.key),
  );
  const activeStatus: DataStatus = dataset.status;

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

  const activeViewModes = getAvailableViewModes();

  const defaultFilters: CrimeMapFilters = {
    indicator: defaultIndicator,
    period: defaultPeriod,
    viewMode:
      defaultPeriodHasTaxaData &&
      activeViewModes.some((option) => option.key === "taxa100k") &&
      mode !== "demo"
        ? "taxa100k"
        : "score",
    uf: null,
  };

  function getDefaultCrimeMapFilters(): CrimeMapFilters {
    return { ...defaultFilters };
  }

  function getAvailableIndicators(): IndicatorOption[] {
    return [...activeIndicators];
  }

  function getAvailablePeriods(): PeriodOption[] {
    return [...activePeriods];
  }

  function getDemoDataStatus(): DataStatus {
    return activeStatus;
  }

  function getCrimeMetadata(): CrimeMetadata {
    return {
      indicators: getAvailableIndicators(),
      periods: getAvailablePeriods(),
      viewModes: [...activeViewModes],
      ufs: getAvailableUfs(),
      defaultFilters: getDefaultCrimeMapFilters(),
      // `supabase` e apenas a origem (Storage); a proveniencia dos dados e
      // oficial. Consolidamos para "official" para nao expor um valor que os
      // consumidores nunca veriam de outra forma.
      dataMode: mode === "supabase" ? "official" : mode,
      scope: getDataScope(),
    };
  }

  function getCrimeMapData(filters: Partial<CrimeMapFilters> = {}): CrimeMapResult {
    const resolved = resolveFilters(filters);
    const items = activeData.filter(
      (item) => item.periodo === resolved.period && (!resolved.uf || item.uf === resolved.uf),
    );

    return {
      demo: mode === "demo",
      status: activeStatus,
      filters: resolved,
      items,
      ranking: getRankedMunicipalities(items, resolved.indicator, resolved.viewMode, null, 10),
      metadata: getCrimeMetadata(),
    };
  }

  function getMunicipalityById(idIbge: string, period = defaultFilters.period): MunicipalityCrimeData | null {
    return activeData.find((municipality) => municipality.idIbge === idIbge && municipality.periodo === period) ?? null;
  }

  function isCrimeIndicatorKey(value: string): value is CrimeIndicatorKey {
    return activeIndicators.some((option) => option.key === value);
  }

  function isViewMode(value: string): value is ViewMode {
    return activeViewModes.some((option) => option.key === value);
  }

  function isUfIndicator(indicator: CrimeIndicatorKey): boolean {
    return ufIndicatorKeys.has(indicator);
  }

  function getUfChoropleth(period: string, indicator: CrimeIndicatorKey): UfDatum[] {
    return activeUfData.filter((datum) => datum.periodo === period && datum.indicador === indicator);
  }

  function getUfDatum(uf: string, period: string, indicator: CrimeIndicatorKey): UfDatum | null {
    const target = uf.toUpperCase();
    return (
      activeUfData.find(
        (datum) => datum.uf === target && datum.periodo === period && datum.indicador === indicator,
      ) ?? null
    );
  }

  function getUfIndicatorData(indicator: CrimeIndicatorKey): UfDatum[] {
    return activeUfData.filter((datum) => datum.indicador === indicator);
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

  return {
    getDefaultCrimeMapFilters,
    getAvailableIndicators,
    getAvailablePeriods,
    getDemoDataStatus,
    getCrimeMetadata,
    getCrimeMapData,
    getMunicipalityById,
    isCrimeIndicatorKey,
    isViewMode,
    isUfIndicator,
    getUfChoropleth,
    getUfDatum,
    getUfIndicatorData,
  };
}

// Aviso unico quando o modo `official` esta ativo mas a carga nacional esta
// vazia (placeholder ou asset ausente). Partilhado pelos loaders cliente/servidor.
export function warnIfEmptyOfficial(dataset: OfficialCrimeDataset): void {
  if (dataset.items.length === 0 && typeof console !== "undefined") {
    console.warn(
      "[crimeDataService] Modo 'official' ativo mas a carga nacional esta vazia. " +
        "Gere os dados com scripts/build_national_dataset.sh e publique em public/officialCrimeData.json (ver docs/CARGA_NACIONAL.md).",
    );
  }
}

// API sincrona do modulo: real para demo/official_sample; placeholder para
// official (substituida pela carga real via getCrimeDataApi/loader). Mantida para
// consumidores que leem metadados sincronos sem precisar da carga nacional.
const staticApi = createCrimeDataApi(CRIME_DATA_MODE, getStaticDataset(CRIME_DATA_MODE));

// API sincrona disponivel no primeiro render. Para demo/official_sample contem os
// dados reais (preserva o SSR); para official e o placeholder vazio ate o loader
// assincrono trazer a carga nacional.
export function getStaticCrimeDataApi(): CrimeDataApi {
  return staticApi;
}

export const getDefaultCrimeMapFilters = staticApi.getDefaultCrimeMapFilters;
export const getAvailableIndicators = staticApi.getAvailableIndicators;
export const getAvailablePeriods = staticApi.getAvailablePeriods;
export const getDemoDataStatus = staticApi.getDemoDataStatus;
export const getCrimeMetadata = staticApi.getCrimeMetadata;
export const getCrimeMapData = staticApi.getCrimeMapData;
export const getMunicipalityById = staticApi.getMunicipalityById;
export const isCrimeIndicatorKey = staticApi.isCrimeIndicatorKey;
export const isViewMode = staticApi.isViewMode;

// Loader assincrono para o CLIENTE. Em demo/official_sample resolve para a API
// estatica (sem rede). Em official, faz fetch do asset em public/ e constroi a
// API com a carga real — mantendo o JSON nacional fora do bundle JS. Em caso de
// erro/asset vazio, recai no placeholder vazio e emite aviso.
let clientApiPromise: Promise<CrimeDataApi> | null = null;

export function loadCrimeDataApi(): Promise<CrimeDataApi> {
  if (!isRemoteDataMode()) {
    return Promise.resolve(staticApi);
  }
  const url = officialDatasetUrl();
  if (!url) {
    if (typeof console !== "undefined") {
      console.warn(
        "[crimeDataService] modo 'supabase' ativo mas NEXT_PUBLIC_SUPABASE_URL nao esta definido. " +
          "Defina-o (ex.: .env.local / Vercel) para carregar a carga do Supabase Storage.",
      );
    }
    return Promise.resolve(createCrimeDataApi("official", EMPTY_OFFICIAL_DATASET));
  }
  if (!clientApiPromise) {
    clientApiPromise = fetch(url)
      .then(async (response) => {
        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status}`);
        }
        // A carga e servida gzipped (.gz); descomprime no cliente.
        const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
        return (await new Response(stream).json()) as OfficialCrimeDataset;
      })
      .then((dataset) => {
        // Sucesso: avisa uma vez se a carga vier vazia (placeholder por gerar).
        warnIfEmptyOfficial(dataset);
        // Os dados sao oficiais independentemente da origem (local ou Supabase).
        return createCrimeDataApi("official", dataset);
      })
      .catch((error) => {
        // Falha de rede/HTTP: avisa uma vez (sem o aviso de "vazio" em duplicado).
        if (typeof console !== "undefined") {
          console.warn(
            `[crimeDataService] Falha ao carregar ${url}: ${String(error)}. A usar placeholder vazio.`,
          );
        }
        return createCrimeDataApi("official", EMPTY_OFFICIAL_DATASET);
      });
  }
  return clientApiPromise;
}
