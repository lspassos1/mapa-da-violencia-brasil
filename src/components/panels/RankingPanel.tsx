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
    <section className="flex max-h-[540px] min-h-0 flex-col rounded-lg border border-line bg-panel p-3 backdrop-blur">
      <div className="mb-3 flex items-center gap-2">
        {isWorst ? (
          <Trophy className="h-4 w-4 shrink-0 text-[#E5533D]" />
        ) : (
          <ShieldCheck className="h-4 w-4 shrink-0 text-positivo" />
        )}
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink">
          {isWorst ? "10 piores indices" : "10 melhores indices"}
        </h2>
      </div>
      {data.length === 0 ? (
        <p className="rounded-lg border border-line bg-panel p-3 text-sm text-ter">
          Nenhum municipio no filtro atual.
        </p>
      ) : (
        <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
          {data.map((item, index) => {
            const metric = item.indicadores[indicator];
            if (!metric) {
              return null;
            }
            const active = item.idIbge === selectedMunicipalityId;
            return (
              <button
                className={`w-full rounded-lg border p-2.5 text-left transition ${
                  active
                    ? "border-edgehover bg-[rgba(236,234,228,.07)]"
                    : "border-line bg-panel/70 hover:border-edge"
                }`}
                key={item.idIbge}
                type="button"
                aria-current={active ? "true" : undefined}
                onClick={() => onSelect(item)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-quat">#{index + 1}</span>
                  <span className="text-[11px] text-ter">{riskLevelLabels[metric.nivel]}</span>
                </div>
                <p className="mt-0.5 truncate text-sm font-semibold text-ink">
                  {item.municipio} <span className="text-quat">/{item.uf}</span>
                </p>
                <dl className="mt-1.5 grid grid-cols-3 gap-1 text-[10px]">
                  <div>
                    <dt className="uppercase tracking-wide text-quat">Indice</dt>
                    <dd className="font-semibold text-ink">{Math.round(metric.score)}/100</dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-wide text-quat">Total</dt>
                    <dd className="font-semibold text-ink">{formatNumber(metric.total)}</dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-wide text-quat" title="Taxa por 100 mil">
                      Taxa
                    </dt>
                    <dd className="font-semibold text-ink">
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
