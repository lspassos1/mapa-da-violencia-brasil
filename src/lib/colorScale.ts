import type { RiskLevel } from "@/types/crime";

export const riskColors: Record<RiskLevel, string> = {
  baixo: "#22c55e",
  moderado: "#eab308",
  atencao: "#f97316",
  alto: "#ef4444",
  critico: "#7f1d1d",
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

