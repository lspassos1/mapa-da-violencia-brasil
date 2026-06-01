export type NewsIncidentType =
  | "homicidio"
  | "feminicidio"
  | "rouboVeiculos"
  | "rouboCarga"
  | "estupro"
  | "traficoDrogas"
  | "outros";

export type NewsIncidentTypeFilter = NewsIncidentType | "todos";

export type NewsIncidentConfidence = "baixa" | "media" | "alta";

export type NewsIncidentReviewStatus = "pendente" | "revisado" | "descartado";

export interface NewsIncident {
  id: string;
  title: string;
  summary: string;
  type: NewsIncidentType;
  municipality: string;
  uf: string;
  state: string;
  idIbge: string;
  lat: number;
  lng: number;
  period: string;
  occurredAt: string;
  publishedAt: string;
  sourceName: string;
  sourceUrl: string;
  confidence: number;
  confidenceLevel: NewsIncidentConfidence;
  status: NewsIncidentReviewStatus;
  extractionMethod: "demo-manual" | "ai-assisted" | "rule-based";
  duplicateGroupId: string | null;
}

export interface NewsIncidentTypeOption {
  key: NewsIncidentTypeFilter;
  label: string;
}

export interface NewsDataStatus {
  source: string;
  lastUpdated: string;
  latestPeriod: string;
  status: string;
}

export interface NewsIncidentFilters {
  period: string;
  uf: string | null;
  type: NewsIncidentTypeFilter;
  minConfidence: number;
  status: NewsIncidentReviewStatus | "todos";
}

export interface NewsIncidentSummary {
  total: number;
  highConfidence: number;
  sources: number;
  reviewed: number;
}

export interface NewsIncidentResult {
  demo: boolean;
  status: NewsDataStatus;
  filters: NewsIncidentFilters;
  items: NewsIncident[];
  summary: NewsIncidentSummary;
}
