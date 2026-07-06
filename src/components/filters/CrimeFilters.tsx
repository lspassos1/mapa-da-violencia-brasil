import { Filter } from "lucide-react";
import type { CrimeIndicatorKey, CrimeMetadata, IndicatorOption, PeriodOption, ViewMode } from "@/types/crime";

interface CrimeFiltersProps {
  indicator: CrimeIndicatorKey;
  indicators: IndicatorOption[];
  period: string;
  periods: PeriodOption[];
  viewMode: ViewMode;
  viewModes: CrimeMetadata["viewModes"];
  onIndicatorChange: (indicator: CrimeIndicatorKey) => void;
  onPeriodChange: (period: string) => void;
  onViewModeChange: (mode: ViewMode) => void;
}

export function CrimeFilters({
  indicator,
  indicators,
  period,
  periods,
  viewMode,
  viewModes,
  onIndicatorChange,
  onPeriodChange,
  onViewModeChange,
}: CrimeFiltersProps) {
  return (
    <section className="rounded-lg border border-line bg-panel p-4 backdrop-blur">
      <div className="mb-4 flex items-center gap-2">
        <Filter className="h-4 w-4 text-sec" />
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-ink">Filtros</h2>
      </div>
      <div className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-xs font-medium text-ter">Indicador</span>
          <select
            className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-edgehover"
            value={indicator}
            onChange={(event) => onIndicatorChange(event.target.value as CrimeIndicatorKey)}
          >
            {indicators.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-medium text-ter">Modo</span>
          <select
            className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-edgehover"
            value={viewMode}
            onChange={(event) => onViewModeChange(event.target.value as ViewMode)}
          >
            {viewModes.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-medium text-ter">Periodo</span>
          <select
            className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-edgehover"
            value={period}
            onChange={(event) => onPeriodChange(event.target.value)}
          >
            {periods.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
