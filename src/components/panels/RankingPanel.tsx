import { ShieldCheck, Trophy } from "lucide-react";
import { riskLevelLabels } from "@/lib/riskLevel";
import { formatDecimal, formatNumber } from "@/lib/formatters";
import type { CrimeIndicatorKey, MunicipalityCrimeData } from "@/types/crime";

interface RankingPanelProps {
  data: MunicipalityCrimeData[];
  indicator: CrimeIndicatorKey;
  selectedMunicipalityId: string | null;
  onSelect: (item: MunicipalityCrimeData) => void;
  // "worst" (padrao): os 10 maiores indices; "best": os 10 menores.
  tone?: "worst" | "best";
}

// Painel de ranking Top 10. Cada item mostra as tres metricas do indicador
// (indice 0-100, total de vitimas/ocorrencias e taxa por 100 mil), independente
// do modo de visualizacao ativo no mapa.
export function RankingPanel({
  data,
  indicator,
  selectedMunicipalityId,
  onSelect,
  tone = "worst",
}: RankingPanelProps) {
  const isWorst = tone === "worst";
  return (
    <section className="min-h-0 rounded-lg border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
      <div className="mb-4 flex items-center gap-2">
        {isWorst ? (
          <Trophy className="h-4 w-4 text-red-300" />
        ) : (
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
        )}
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-200">
          {isWorst ? "10 piores indices" : "10 melhores indices"}
        </h2>
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
                <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <dt className="uppercase tracking-wide text-slate-500">Indice</dt>
                    <dd className="font-semibold text-slate-200">{Math.round(metric.score)}/100</dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-wide text-slate-500">Total</dt>
                    <dd className="font-semibold text-slate-200">{formatNumber(metric.total)}</dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-wide text-slate-500">Taxa/100 mil</dt>
                    <dd className="font-semibold text-slate-200">
                      {typeof metric.taxa100k === "number" ? formatDecimal(metric.taxa100k) : "—"}
                    </dd>
                  </div>
                </dl>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
