import { BarChart3, MapPinned } from "lucide-react";
import { getDataStatusDescription, getDataStatusLabel, isUnavailableStatus } from "@/lib/dataStatus";
import { formatDecimal, formatNumber } from "@/lib/formatters";
import { getMunicipalityRank } from "@/lib/ranking";
import { riskLevelLabels } from "@/lib/riskLevel";
import { getAvailableIndicators, getDemoDataStatus } from "@/services/crimeDataService";
import { getStateByUf } from "@/services/geoService";
import type { CrimeIndicatorKey, MunicipalityCrimeData, ViewMode } from "@/types/crime";

interface MunicipalityDetailsPanelProps {
  allData: MunicipalityCrimeData[];
  indicator: CrimeIndicatorKey;
  municipality: MunicipalityCrimeData | null;
  selectedState: string | null;
  viewMode: ViewMode;
}

const indicatorOptions = getAvailableIndicators();
const demoDataStatus = getDemoDataStatus();

export function MunicipalityDetailsPanel({
  allData,
  indicator,
  municipality,
  selectedState,
  viewMode,
}: MunicipalityDetailsPanelProps) {
  if (!municipality) {
    const state = getStateByUf(selectedState);
    const stateItems = selectedState ? allData.filter((item) => item.uf === selectedState) : [];

    return (
      <section className="flex flex-1 flex-col justify-center rounded-lg border border-white/10 bg-white/[0.04] p-5 text-center backdrop-blur">
        <MapPinned className="mx-auto h-8 w-8 text-cyan-300" />
        <h2 className="mt-4 text-lg font-semibold">
          {state ? `${state.nome} em foco` : "Nenhum municipio selecionado"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          {state
            ? `${stateItems.length} municipios disponiveis neste recorte. Clique em uma cidade no mapa ou no ranking para abrir os detalhes.`
            : "Clique em uma cidade no mapa ou em um item do ranking para ver detalhes demonstrativos."}
        </p>
      </section>
    );
  }

  const metric = municipality.indicadores[indicator];
  const indicatorLabel = indicatorOptions.find((option) => option.key === indicator)?.label ?? "Indicador";
  const stateRank = getMunicipalityRank(allData, municipality.idIbge, indicator, viewMode, municipality.uf);
  const nationalRank = getMunicipalityRank(allData, municipality.idIbge, indicator, viewMode);
  if (!metric) {
    return (
      <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Municipio</p>
        <h2 className="mt-1 text-2xl font-semibold text-white">{municipality.municipio}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Este indicador nao esta disponivel para o municipio e periodo selecionados.
        </p>
      </section>
    );
  }
  const general = municipality.indicadores.indiceGeral;
  const unitLabel = metric.unidade === "vitimas" ? "Vitimas" : metric.unidade === "ocorrencias" ? "Ocorrencias" : "Indice";

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Municipio</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">{municipality.municipio}</h2>
          <p className="text-sm text-slate-400">
            {municipality.estado} / {municipality.uf}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-right">
            <p className="text-xs text-slate-500">Nivel</p>
            <p className="font-semibold text-white">{riskLevelLabels[metric.nivel]}</p>
          </div>
          <span
            className={`rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
              isUnavailableStatus(metric.dataStatus)
                ? "bg-amber-300/15 text-amber-200"
                : "bg-cyan-300/15 text-cyan-200"
            }`}
            title={getDataStatusDescription(metric.dataStatus)}
          >
            {getDataStatusLabel(metric.dataStatus)}
          </span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <MetricCard label="Indice geral" value={general ? `${general.score}/100` : "Nao aplicavel"} />
        <MetricCard label="Populacao" value={formatNumber(municipality.populacao)} />
        <MetricCard label={`${indicatorLabel} (${unitLabel.toLowerCase()})`} value={formatNumber(metric.total)} />
        <MetricCard label="Taxa por 100 mil" value={formatDecimal(metric.taxa100k)} />
        <MetricCard
          label="Variacao mensal"
          value={metric.variacaoMensal === null ? "Sem serie" : `${metric.variacaoMensal > 0 ? "+" : ""}${formatDecimal(metric.variacaoMensal)}%`}
        />
        <MetricCard
          label="Variacao anual"
          value={metric.variacaoAnual === null ? "Sem serie" : `${metric.variacaoAnual > 0 ? "+" : ""}${formatDecimal(metric.variacaoAnual)}%`}
        />
        <MetricCard label="Ranking estadual" value={stateRank ? `${stateRank}º` : "-"} />
        <MetricCard label="Ranking nacional" value={nationalRank ? `${nationalRank}º` : "-"} />
      </div>

      <div className="mt-5 rounded-lg border border-white/10 bg-slate-950/70 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-100">
          <BarChart3 className="h-4 w-4 text-cyan-300" />
          Fonte e atualizacao
        </div>
        <p className="text-sm leading-6 text-slate-400">
          {metric.fonte}. Atualizado em {demoDataStatus.lastUpdated}. Unidade exibida: {unitLabel.toLowerCase()}.
          {isUnavailableStatus(metric.dataStatus) ? ` ${getDataStatusDescription(metric.dataStatus)}` : ""}
          {metric.limitacoes ? ` ${metric.limitacoes}` : ""}
        </p>
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/75 p-3">
      <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-100">{value}</p>
    </div>
  );
}
