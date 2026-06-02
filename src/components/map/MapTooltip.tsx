import type { CrimeIndicatorKey, MunicipalityCrimeData } from "@/types/crime";
import { riskLevelLabels } from "@/lib/riskLevel";

interface TooltipState {
  x: number;
  y: number;
  item: MunicipalityCrimeData;
}

interface MapTooltipProps {
  indicator: CrimeIndicatorKey;
  tooltip: TooltipState | null;
}

export function MapTooltip({ indicator, tooltip }: MapTooltipProps) {
  if (!tooltip) {
    return null;
  }

  const metric = tooltip.item.indicadores[indicator];
  if (!metric) {
    return null;
  }
  const unitLabel = metric.unidade === "vitimas" ? "Vitimas" : metric.unidade === "ocorrencias" ? "Ocorrencias" : "Valor";
  return (
    <div
      className="pointer-events-none absolute z-20 w-56 rounded-lg border border-white/10 bg-slate-950/90 p-3 text-xs shadow-2xl backdrop-blur"
      style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
    >
      <p className="text-sm font-semibold text-white">
        {tooltip.item.municipio} - {tooltip.item.uf}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-slate-300">
        <span>Indice</span>
        <strong className="text-right text-white">{metric.score}/100</strong>
        <span>{unitLabel}</span>
        <strong className="text-right text-white">{metric.total}</strong>
        <span>Nivel</span>
        <strong className="text-right text-white">{riskLevelLabels[metric.nivel]}</strong>
      </div>
    </div>
  );
}
