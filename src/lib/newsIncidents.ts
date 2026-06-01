import type { NewsIncidentConfidence, NewsIncidentType } from "@/types/news";

export const newsIncidentTypeLabels: Record<NewsIncidentType, string> = {
  homicidio: "Homicidio",
  feminicidio: "Feminicidio",
  rouboVeiculos: "Roubo de veiculos",
  rouboCarga: "Roubo de carga",
  estupro: "Estupro",
  traficoDrogas: "Trafico de drogas",
  outros: "Outros",
};

export const newsConfidenceLabels: Record<NewsIncidentConfidence, string> = {
  baixa: "Baixa",
  media: "Media",
  alta: "Alta",
};

export function getNewsIncidentTypeLabel(type: NewsIncidentType): string {
  return newsIncidentTypeLabels[type];
}

export function getNewsConfidenceLabel(level: NewsIncidentConfidence): string {
  return newsConfidenceLabels[level];
}

export function getNewsConfidenceColor(confidence: number): string {
  if (confidence >= 0.82) return "#f59e0b";
  if (confidence >= 0.68) return "#fbbf24";
  return "#fde68a";
}

export function getNewsPointRadius(confidence: number): number {
  if (confidence >= 0.82) return 12;
  if (confidence >= 0.68) return 10;
  return 8;
}
