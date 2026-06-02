export type CrimeIndicatorKey =
  | "indiceGeral"
  | "homicidioDoloso"
  | "feminicidio"
  | "rouboVeiculos"
  | "rouboCarga"
  | "estupro"
  | "traficoDrogas"
  | "furtoVeiculos";

export type ViewMode = "score" | "total" | "taxa100k" | "variacaoMensal";

export type RiskLevel = "baixo" | "moderado" | "atencao" | "alto" | "critico";

export type DataAvailabilityStatus =
  | "oficial"
  | "amostra_oficial"
  | "demo"
  | "sem_dados"
  | "zero_registrado"
  | "populacao_indisponivel"
  | "nao_aplicavel";

export type CrimeMetricUnit = "ocorrencias" | "vitimas" | "indice";

export interface CrimeMetric {
  score: number;
  nivel: RiskLevel;
  total: number;
  taxa100k: number | null;
  variacaoMensal: number | null;
  variacaoAnual: number | null;
  dataStatus: DataAvailabilityStatus;
  unidade: CrimeMetricUnit;
  fonte: string;
  sourceId?: string;
  limitacoes?: string;
}

export type CrimeIndicators = Partial<Record<CrimeIndicatorKey, CrimeMetric>>;

export interface MunicipalityCrimeData {
  idIbge: string;
  municipio: string;
  uf: string;
  estado: string;
  lat: number;
  lng: number;
  populacao: number;
  periodo: string;
  indicadores: CrimeIndicators;
}

export interface IndicatorOption {
  key: CrimeIndicatorKey;
  label: string;
  codigo?: string;
  unidade?: CrimeMetricUnit;
  oficial?: boolean;
}

export interface PeriodOption {
  key: string;
  label: string;
  updatedAt: string;
}

export interface DataStatus {
  source: string;
  lastUpdated: string;
  latestPeriod: string;
  status: string;
  mode?: "official" | "official_sample" | "demo";
  sourceId?: string;
  unit?: CrimeMetricUnit;
  limitations?: string[];
}

export interface CrimeMapFilters {
  indicator: CrimeIndicatorKey;
  period: string;
  viewMode: ViewMode;
  uf: string | null;
}

export interface CrimeMapResult {
  demo: boolean;
  status: DataStatus;
  filters: CrimeMapFilters;
  items: MunicipalityCrimeData[];
  ranking: MunicipalityCrimeData[];
  metadata?: CrimeMetadata;
}

export interface CrimeMetadata {
  indicators: IndicatorOption[];
  periods: PeriodOption[];
  viewModes: Array<{ key: ViewMode; label: string }>;
  ufs: Array<{ uf: string; nome: string }>;
  defaultFilters: CrimeMapFilters;
  dataMode: "official" | "official_sample" | "demo";
}
