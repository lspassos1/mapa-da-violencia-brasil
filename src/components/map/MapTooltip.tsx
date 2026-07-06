import type { CrimeIndicatorKey, MunicipalityCrimeData } from "@/types/crime";
import { getDataStatusDescription, getDataStatusLabel, isUnavailableStatus } from "@/lib/dataStatus";
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

// Tooltip no tema do instrumento: painel quadrado com border-top na cor da
// rampa oficial. "Sem dado" usa cinza — âmbar é exclusivo de indício/OSINT.
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
      className="pointer-events-none absolute z-20 w-60 border border-[#2A2F37] border-t-2 border-t-oficial5 bg-[rgba(12,13,16,.96)] p-3 text-xs backdrop-blur-[6px]"
      style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
    >
      <p className="font-mono text-[9px] tracking-[.2em] text-quat">■ OFICIAL — {tooltip.item.uf}</p>
      <p className="mt-1 text-[13.5px] font-semibold text-ink">{tooltip.item.municipio}</p>
      <div className="mt-2 grid grid-cols-2 gap-1.5 font-mono text-[10.5px] text-sec">
        <span className="text-ter">Índice</span>
        <strong className="text-right font-medium text-ink">{metric.score}/100</strong>
        <span className="text-ter">{unitLabel}</span>
        <strong className="text-right font-medium text-ink">{metric.total}</strong>
        <span className="text-ter">Nível</span>
        <strong className="text-right font-medium text-ink">{riskLevelLabels[metric.nivel]}</strong>
      </div>
      <div className="mt-2 border-t border-hair pt-2">
        <span
          className={`inline-block px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-[.12em] ${
            isUnavailableStatus(metric.dataStatus) ? "bg-[rgba(86,91,99,.2)] text-sec" : "bg-[rgba(236,234,228,.08)] text-sec"
          }`}
        >
          {getDataStatusLabel(metric.dataStatus)}
        </span>
        {isUnavailableStatus(metric.dataStatus) ? (
          <p className="mt-1 leading-4 text-ter">{getDataStatusDescription(metric.dataStatus)}</p>
        ) : null}
      </div>
    </div>
  );
}
