import type { RiskLevel } from "@/types/crime";

// Rampa oficial de 5 pontos (design handoff): escuro → vermelho vivo.
// Reservada à ESTATÍSTICA OFICIAL (choropleth/score) — âmbar fica fora dela
// de propósito (âmbar = indício/OSINT, nunca dado oficial).
export const riskColors: Record<RiskLevel, string> = {
  baixo: "#23272E",
  moderado: "#4B2C2A",
  atencao: "#7A342C",
  alto: "#B03D2C",
  critico: "#E5533D",
};

export function getScoreColor(score: number): string {
  if (score <= 20) return riskColors.baixo;
  if (score <= 40) return riskColors.moderado;
  if (score <= 60) return riskColors.atencao;
  if (score <= 80) return riskColors.alto;
  return riskColors.critico;
}

export function getScoreRadius(score: number): number {
  return Math.max(7, Math.min(22, 7 + score / 6));
}
