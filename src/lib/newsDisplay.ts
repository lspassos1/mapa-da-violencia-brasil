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

// Cor por nivel de confianca — monocromia de INDÍCIO (âmbar por intensidade):
// alto = âmbar pleno, médio = âmbar-texto, baixo = âmbar-dim. Verde fica fora
// (reservado a deltas de queda) e o âmbar segue exclusivo da camada de indício.
export function confidenceColor(c: number): string {
  if (c >= 0.75) return "#E2A33B";
  if (c >= 0.5) return "#C9A15E";
  return "#8A6B33";
}

export function confidencePct(c: number): string {
  return `${Math.round(c * 100)}%`;
}
