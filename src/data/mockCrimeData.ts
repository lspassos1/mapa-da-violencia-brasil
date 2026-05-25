import type {
  CrimeIndicatorKey,
  CrimeIndicators,
  CrimeMetric,
  IndicatorOption,
  MunicipalityCrimeData,
  PeriodOption,
  RiskLevel,
} from "@/types/crime";

export const indicatorOptions: IndicatorOption[] = [
  { key: "indiceGeral", label: "Indice geral" },
  { key: "homicidioDoloso", label: "Homicidio doloso" },
  { key: "feminicidio", label: "Feminicidio" },
  { key: "rouboVeiculos", label: "Roubo de veiculos" },
  { key: "rouboCarga", label: "Roubo de carga" },
  { key: "estupro", label: "Estupro" },
  { key: "traficoDrogas", label: "Trafico de drogas" },
  { key: "furtoVeiculos", label: "Furto de veiculos" },
];

export const periodOptions: PeriodOption[] = [
  { key: "2026-04", label: "Abr/2026", updatedAt: "25/05/2026" },
  { key: "2026-03", label: "Mar/2026", updatedAt: "20/04/2026" },
  { key: "2025-04", label: "Abr/2025", updatedAt: "22/05/2025" },
];

const indicatorKeys = indicatorOptions.map((option) => option.key);

interface MunicipalitySeed {
  idIbge: string;
  municipio: string;
  uf: string;
  estado: string;
  lat: number;
  lng: number;
  populacao: number;
  baseScore: number;
}

const municipalitySeeds: MunicipalitySeed[] = [
  { idIbge: "3550308", municipio: "Sao Paulo", uf: "SP", estado: "Sao Paulo", lat: -23.5505, lng: -46.6333, populacao: 11451999, baseScore: 73 },
  { idIbge: "3509502", municipio: "Campinas", uf: "SP", estado: "Sao Paulo", lat: -22.9099, lng: -47.0626, populacao: 1139047, baseScore: 58 },
  { idIbge: "3548500", municipio: "Santos", uf: "SP", estado: "Sao Paulo", lat: -23.9608, lng: -46.3336, populacao: 418608, baseScore: 46 },
  { idIbge: "3304557", municipio: "Rio de Janeiro", uf: "RJ", estado: "Rio de Janeiro", lat: -22.9068, lng: -43.1729, populacao: 6211223, baseScore: 84 },
  { idIbge: "3303302", municipio: "Niteroi", uf: "RJ", estado: "Rio de Janeiro", lat: -22.8832, lng: -43.1034, populacao: 481749, baseScore: 42 },
  { idIbge: "3301702", municipio: "Duque de Caxias", uf: "RJ", estado: "Rio de Janeiro", lat: -22.7858, lng: -43.3049, populacao: 808161, baseScore: 79 },
  { idIbge: "2927408", municipio: "Salvador", uf: "BA", estado: "Bahia", lat: -12.9777, lng: -38.5016, populacao: 2418005, baseScore: 88 },
  { idIbge: "2910800", municipio: "Feira de Santana", uf: "BA", estado: "Bahia", lat: -12.2664, lng: -38.9663, populacao: 616279, baseScore: 71 },
  { idIbge: "2611606", municipio: "Recife", uf: "PE", estado: "Pernambuco", lat: -8.0476, lng: -34.877, populacao: 1488920, baseScore: 82 },
  { idIbge: "2304400", municipio: "Fortaleza", uf: "CE", estado: "Ceara", lat: -3.7319, lng: -38.5267, populacao: 2428678, baseScore: 86 },
  { idIbge: "3106200", municipio: "Belo Horizonte", uf: "MG", estado: "Minas Gerais", lat: -19.9167, lng: -43.9345, populacao: 2315560, baseScore: 55 },
  { idIbge: "3118601", municipio: "Contagem", uf: "MG", estado: "Minas Gerais", lat: -19.9317, lng: -44.0536, populacao: 621865, baseScore: 63 },
  { idIbge: "5300108", municipio: "Brasilia", uf: "DF", estado: "Distrito Federal", lat: -15.7939, lng: -47.8828, populacao: 2817381, baseScore: 52 },
  { idIbge: "5208707", municipio: "Goiania", uf: "GO", estado: "Goias", lat: -16.6869, lng: -49.2648, populacao: 1437366, baseScore: 61 },
  { idIbge: "1302603", municipio: "Manaus", uf: "AM", estado: "Amazonas", lat: -3.119, lng: -60.0217, populacao: 2063547, baseScore: 77 },
  { idIbge: "1501402", municipio: "Belem", uf: "PA", estado: "Para", lat: -1.4558, lng: -48.4902, populacao: 1303403, baseScore: 83 },
  { idIbge: "4106902", municipio: "Curitiba", uf: "PR", estado: "Parana", lat: -25.4284, lng: -49.2733, populacao: 1773718, baseScore: 44 },
  { idIbge: "4314902", municipio: "Porto Alegre", uf: "RS", estado: "Rio Grande do Sul", lat: -30.0346, lng: -51.2177, populacao: 1332845, baseScore: 48 },
];

const indicatorWeights: Record<CrimeIndicatorKey, number> = {
  indiceGeral: 1,
  homicidioDoloso: 1.12,
  feminicidio: 0.64,
  rouboVeiculos: 0.91,
  rouboCarga: 0.76,
  estupro: 0.72,
  traficoDrogas: 0.86,
  furtoVeiculos: 0.68,
};

const periodModifiers: Record<string, number> = {
  "2026-04": 0,
  "2026-03": -5,
  "2025-04": -8,
};

export const demoDataStatus = {
  source: "Dados demonstrativos nesta versao",
  lastUpdated: "25/05/2026",
  latestPeriod: "Abr/2026",
  status: "Mock local",
};

export const mockCrimeData: MunicipalityCrimeData[] = periodOptions.flatMap((period, periodIndex) =>
  municipalitySeeds.map((seed, seedIndex) => ({
    idIbge: seed.idIbge,
    municipio: seed.municipio,
    uf: seed.uf,
    estado: seed.estado,
    lat: seed.lat,
    lng: seed.lng,
    populacao: seed.populacao,
    periodo: period.key,
    indicadores: createIndicators(seed, period.key, seedIndex, periodIndex),
  })),
);

function createIndicators(
  seed: MunicipalitySeed,
  period: string,
  seedIndex: number,
  periodIndex: number,
): CrimeIndicators {
  const entries = indicatorKeys.map((indicator, indicatorIndex) => {
    const metric = createMetric(seed, indicator, period, seedIndex, periodIndex, indicatorIndex);
    return [indicator, metric] as const;
  });
  return Object.fromEntries(entries) as CrimeIndicators;
}

function createMetric(
  seed: MunicipalitySeed,
  indicator: CrimeIndicatorKey,
  period: string,
  seedIndex: number,
  periodIndex: number,
  indicatorIndex: number,
): CrimeMetric {
  const weight = indicatorWeights[indicator];
  const wave = ((seedIndex * 7 + indicatorIndex * 11 + periodIndex * 5) % 17) - 8;
  const score = clamp(Math.round(seed.baseScore * weight + wave + periodModifiers[period]), 4, 98);
  const baseVolume = indicator === "indiceGeral" ? 0.00042 : 0.00006 + indicatorIndex * 0.000018;
  const total = indicator === "indiceGeral" ? Math.round(score) : Math.max(0, Math.round(seed.populacao * baseVolume * (score / 75)));
  const taxa100k = Number(((total / seed.populacao) * 100000).toFixed(2));
  const variacaoMensal = Number((((score - seed.baseScore) / Math.max(seed.baseScore, 1)) * 24).toFixed(1));
  const variacaoAnual = Number((((score - (seed.baseScore - 7)) / Math.max(seed.baseScore, 1)) * 31).toFixed(1));

  return {
    score,
    nivel: riskLevelFromScore(score),
    total,
    taxa100k,
    variacaoMensal,
    variacaoAnual,
  };
}

function riskLevelFromScore(score: number): RiskLevel {
  if (score <= 20) return "baixo";
  if (score <= 40) return "moderado";
  if (score <= 60) return "atencao";
  if (score <= 80) return "alto";
  return "critico";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
