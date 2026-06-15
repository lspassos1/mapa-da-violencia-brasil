// Rotulos e cores da camada OSINT (apresentacao).
import type { NewsIncidentType, NewsReviewStatus } from "@/types/news";

export const NEWS_TYPE_LABEL: Record<NewsIncidentType, string> = {
  homicidio: "Homicídio",
  feminicidio: "Feminicídio",
  latrocinio: "Latrocínio",
  roubo: "Roubo",
  furto: "Furto",
  trafico: "Tráfico de drogas",
  violencia_sexual: "Violência sexual",
  violencia_politica: "Violência política",
  outro: "Outro",
};

export const REVIEW_LABEL: Record<NewsReviewStatus, string> = {
  confirmado: "auto-confirmado",
  pendente: "a rever",
  rejeitado: "rejeitado",
};

// Cor por nivel de confianca (verde alto / ambar medio / laranja baixo).
export function confidenceColor(c: number): string {
  if (c >= 0.75) return "#22c55e";
  if (c >= 0.5) return "#eab308";
  return "#f97316";
}

export function confidencePct(c: number): string {
  return `${Math.round(c * 100)}%`;
}
