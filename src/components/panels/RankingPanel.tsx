import { Trophy } from "lucide-react";
import { getMetricValue } from "@/lib/crimeMetrics";
import { riskLevelLabels } from "@/lib/riskLevel";
import { formatMetricValue } from "@/lib/formatters";
import type { CrimeIndicatorKey, MunicipalityCrimeData, ViewMode } from "@/types/crime";

interface RankingPanelProps {
  data: MunicipalityCrimeData[];
  indicator: CrimeIndicatorKey;
  selectedMunicipalityId: string | null;
  viewMode: ViewMode;
  onSelect: (item: MunicipalityCrimeData) => void;
}

export function RankingPanel({
  data,
  indicator,
  selectedMunicipalityId,
  viewMode,
  onSelect,
}: RankingPanelProps) {
  return (
    <section className="min-h-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
      <div className="mb-4 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-amber-300" />
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-200">Ranking top 10</h2>
      </div>
      {data.length === 0 ? (
        <p className="rounded-lg border border-white/10 bg-slate-950 p-3 text-sm text-slate-400">
          Nenhum municipio no filtro atual.
        </p>
      ) : (
        <div className="space-y-2">
          {data.map((item, index) => {
            const metric = item.indicadores[indicator];
            if (!metric) {
              return null;
            }
            const active = item.idIbge === selectedMunicipalityId;
            return (
              <button
                className={`w-full rounded-lg border p-3 text-left transition ${
                  active
                    ? "border-cyan-300/60 bg-cyan-300/10"
                    : "border-white/10 bg-slate-950/70 hover:border-cyan-300/30"
                }`}
                key={item.idIbge}
                type="button"
                aria-current={active ? "true" : undefined}
                onClick={() => onSelect(item)}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-500">#{index + 1}</span>
                  <span className="text-xs text-slate-400">{riskLevelLabels[metric.nivel]}</span>
                </div>
                <p className="mt-1 font-semibold text-slate-100">
                  {item.municipio} <span className="text-slate-500">/{item.uf}</span>
                </p>
                <p className="mt-1 text-sm text-slate-300">{formatMetricValue(getMetricValue(item, indicator, viewMode), viewMode)}</p>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
