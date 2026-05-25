import { Filter } from "lucide-react";
import type { CrimeIndicatorKey, IndicatorOption, PeriodOption, ViewMode } from "@/types/crime";

const viewModeOptions: Array<{ key: ViewMode; label: string }> = [
  { key: "score", label: "Indice 0-100" },
  { key: "total", label: "Total de ocorrencias" },
  { key: "taxa100k", label: "Taxa por 100 mil" },
  { key: "variacaoMensal", label: "Variacao mensal" },
];

interface CrimeFiltersProps {
  indicator: CrimeIndicatorKey;
  indicators: IndicatorOption[];
  period: string;
  periods: PeriodOption[];
  viewMode: ViewMode;
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
  onIndicatorChange,
  onPeriodChange,
  onViewModeChange,
}: CrimeFiltersProps) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
      <div className="mb-4 flex items-center gap-2">
        <Filter className="h-4 w-4 text-cyan-300" />
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-200">Filtros</h2>
      </div>
      <div className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-xs font-medium text-slate-400">Indicador</span>
          <select
            className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300"
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
          <span className="mb-2 block text-xs font-medium text-slate-400">Modo</span>
          <select
            className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300"
            value={viewMode}
            onChange={(event) => onViewModeChange(event.target.value as ViewMode)}
          >
            {viewModeOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-medium text-slate-400">Periodo</span>
          <select
            className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300"
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

