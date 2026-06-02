import type { ViewMode } from "@/types/crime";

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function formatDecimal(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "Indisponivel";
  }
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
}

export function formatMetricValue(value: number, viewMode: ViewMode): string {
  if (!Number.isFinite(value)) {
    return "Sem dados";
  }
  if (viewMode === "total") return formatNumber(value);
  if (viewMode === "taxa100k") return `${formatDecimal(value)} / 100 mil`;
  if (viewMode === "variacaoMensal") return `${value > 0 ? "+" : ""}${formatDecimal(value)}%`;
  return `${Math.round(value)}/100`;
}
