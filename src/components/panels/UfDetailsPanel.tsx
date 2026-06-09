import { AlertTriangle, Landmark } from "lucide-react";
import { formatDecimal, formatNumber } from "@/lib/formatters";
import { riskColors } from "@/lib/colorScale";
import { riskLevelLabels } from "@/lib/riskLevel";
import type { IndicatorOption, UfDatum } from "@/types/crime";

interface UfDetailsPanelProps {
  indicators: IndicatorOption[];
  indicatorKey: string;
  ufNome: string | null;
  selectedState: string | null;
  datum: UfDatum | null;
}

// Painel de detalhe para indicadores que so existem a nivel estadual no VDE
// (patrimoniais/sexuais, morte por intervencao do Estado). Mostra o total do
// estado selecionado com um aviso de que nao ha detalhe municipal.
export function UfDetailsPanel({ indicators, indicatorKey, ufNome, selectedState, datum }: UfDetailsPanelProps) {
  const label = indicators.find((option) => option.key === indicatorKey)?.label ?? "Indicador";
  const unidade = datum?.unidade === "vitimas" ? "vitimas" : "ocorrencias";

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
      <div className="flex items-center gap-2 text-cyan-300">
        <Landmark className="h-4 w-4" />
        <p className="text-xs uppercase tracking-[0.18em]">Indicador estadual</p>
      </div>

      <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-300/20 bg-amber-300/[0.06] p-2 text-[11px] leading-snug text-amber-100/90">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          <span className="font-semibold">{label}</span> so existe a nivel estadual na Base VDE;
          colore o mapa nacional dos estados, sem detalhe por municipio.
        </span>
      </div>

      {selectedState && datum ? (
        <div className="mt-3 space-y-3 text-sm text-slate-300">
          <p className="text-base font-semibold text-slate-100">{ufNome ?? selectedState}</p>
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">Total ({unidade})</dt>
              <dd className="text-lg font-semibold text-slate-100">{formatNumber(datum.total)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">Taxa / 100 mil</dt>
              <dd className="text-lg font-semibold text-slate-100">
                {typeof datum.taxa100k === "number" ? formatDecimal(datum.taxa100k) : "Indisponivel"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">Nivel</dt>
              <dd className="flex items-center gap-2 font-semibold text-slate-100">
                <span className="inline-block h-3 w-3 rounded-full" style={{ background: riskColors[datum.nivel] }} />
                {riskLevelLabels[datum.nivel]}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">Indice</dt>
              <dd className="text-lg font-semibold text-slate-100">{datum.score}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-400">
          Clique num estado no mapa ou no ranking para ver o total estadual deste indicador.
        </p>
      )}
    </div>
  );
}
