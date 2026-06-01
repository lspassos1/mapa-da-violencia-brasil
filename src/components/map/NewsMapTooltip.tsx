import { getNewsConfidenceLabel, getNewsIncidentTypeLabel } from "@/lib/newsIncidents";
import type { NewsIncident } from "@/types/news";

interface NewsTooltipState {
  x: number;
  y: number;
  item: NewsIncident;
}

interface NewsMapTooltipProps {
  tooltip: NewsTooltipState | null;
}

export function NewsMapTooltip({ tooltip }: NewsMapTooltipProps) {
  if (!tooltip) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute z-20 w-64 rounded-lg border border-amber-300/20 bg-slate-950/90 p-3 text-xs shadow-2xl backdrop-blur"
      style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
    >
      <p className="text-sm font-semibold text-white">{tooltip.item.municipality}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-slate-300">
        <span>Tipo</span>
        <strong className="text-right text-amber-100">{getNewsIncidentTypeLabel(tooltip.item.type)}</strong>
        <span>Confianca</span>
        <strong className="text-right text-white">
          {getNewsConfidenceLabel(tooltip.item.confidenceLevel)} ({Math.round(tooltip.item.confidence * 100)}%)
        </strong>
      </div>
    </div>
  );
}
