import type { RiskLevel } from "@/types/crime";

export const riskLevelLabels: Record<RiskLevel, string> = {
  baixo: "Baixo",
  moderado: "Moderado",
  atencao: "Atencao",
  alto: "Alto",
  critico: "Critico",
};

export function getRiskLevel(score: number): RiskLevel {
  if (score <= 20) return "baixo";
  if (score <= 40) return "moderado";
  if (score <= 60) return "atencao";
  if (score <= 80) return "alto";
  return "critico";
}

