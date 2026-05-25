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

export interface CrimeMetric {
  score: number;
  nivel: RiskLevel;
  total: number;
  taxa100k: number;
  variacaoMensal: number;
  variacaoAnual: number;
}

export type CrimeIndicators = Record<CrimeIndicatorKey, CrimeMetric>;

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
}

export interface PeriodOption {
  key: string;
  label: string;
  updatedAt: string;
}

