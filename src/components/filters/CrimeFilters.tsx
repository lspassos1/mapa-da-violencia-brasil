import { Filter, Layers, Newspaper } from "lucide-react";
import type { CrimeIndicatorKey, IndicatorOption, PeriodOption, ViewMode } from "@/types/crime";
import type { MapDataLayer } from "@/types/map";
import type { NewsIncidentTypeFilter, NewsIncidentTypeOption } from "@/types/news";

const viewModeOptions: Array<{ key: ViewMode; label: string }> = [
  { key: "score", label: "Indice 0-100" },
  { key: "total", label: "Total de ocorrencias" },
  { key: "taxa100k", label: "Taxa por 100 mil" },
  { key: "variacaoMensal", label: "Variacao mensal" },
];

const dataLayerOptions: Array<{ key: MapDataLayer; label: string }> = [
  { key: "official", label: "Dados" },
  { key: "news", label: "Noticias" },
  { key: "both", label: "Ambos" },
];

const confidenceOptions = [
  { key: 0.5, label: "50%+" },
  { key: 0.6, label: "60%+" },
  { key: 0.75, label: "75%+" },
  { key: 0.85, label: "85%+" },
];

interface CrimeFiltersProps {
  indicator: CrimeIndicatorKey;
  indicators: IndicatorOption[];
  mapLayer: MapDataLayer;
  newsConfidenceMin: number;
  newsType: NewsIncidentTypeFilter;
  newsTypes: NewsIncidentTypeOption[];
  period: string;
  periods: PeriodOption[];
  viewMode: ViewMode;
  onIndicatorChange: (indicator: CrimeIndicatorKey) => void;
  onMapLayerChange: (layer: MapDataLayer) => void;
  onNewsConfidenceMinChange: (confidence: number) => void;
  onNewsTypeChange: (type: NewsIncidentTypeFilter) => void;
  onPeriodChange: (period: string) => void;
  onViewModeChange: (mode: ViewMode) => void;
}

export function CrimeFilters({
  indicator,
  indicators,
  mapLayer,
  newsConfidenceMin,
  newsType,
  newsTypes,
  period,
  periods,
  viewMode,
  onIndicatorChange,
  onMapLayerChange,
  onNewsConfidenceMinChange,
  onNewsTypeChange,
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
        <div>
          <span className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-400">
            <Layers className="h-3.5 w-3.5 text-cyan-300" />
            Camada
          </span>
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-white/10 bg-slate-950 p-1">
            {dataLayerOptions.map((option) => (
              <button
                key={option.key}
                className={`rounded-md px-2 py-2 text-xs font-semibold transition ${
                  mapLayer === option.key
                    ? "bg-cyan-300 text-slate-950"
                    : "text-slate-300 hover:bg-white/10 hover:text-slate-100"
                }`}
                type="button"
                onClick={() => onMapLayerChange(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

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

        {mapLayer !== "official" ? (
          <div className="rounded-lg border border-amber-300/15 bg-amber-300/[0.04] p-3">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-100">
              <Newspaper className="h-3.5 w-3.5" />
              Noticias
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-2 block text-xs font-medium text-slate-400">Tipo</span>
                <select
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-200"
                  value={newsType}
                  onChange={(event) => onNewsTypeChange(event.target.value as NewsIncidentTypeFilter)}
                >
                  {newsTypes.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-medium text-slate-400">Confianca minima</span>
                <select
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-200"
                  value={newsConfidenceMin}
                  onChange={(event) => onNewsConfidenceMinChange(Number(event.target.value))}
                >
                  {confidenceOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
