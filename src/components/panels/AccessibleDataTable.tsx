import { getDataStatusLabel } from "@/lib/dataStatus";
import { getMetricValue } from "@/lib/crimeMetrics";
import { formatMetricValue } from "@/lib/formatters";
import { riskLevelLabels } from "@/lib/riskLevel";
import { MapLegend } from "@/components/map/MapLegend";
import type { CrimeIndicatorKey, MunicipalityCrimeData, ViewMode } from "@/types/crime";

interface AccessibleDataTableProps {
  data: MunicipalityCrimeData[];
  total: number;
  indicator: CrimeIndicatorKey;
  indicatorLabel: string;
  viewMode: ViewMode;
  viewModeLabel: string;
  periodLabel: string;
  selectedMunicipalityId: string | null;
  onSelect: (item: MunicipalityCrimeData) => void;
  // Exporta as linhas filtradas atuais (todas, nao so as renderizadas) em CSV.
  onExport?: () => void;
}

// Alternativa acessivel ao mapa WebGL: a mesma informacao numa tabela
// semantica, totalmente operavel por teclado (Tab/Enter nos botoes de cada
// linha) e anunciada por leitores de ecra.
export function AccessibleDataTable({
  data,
  total,
  indicator,
  indicatorLabel,
  viewMode,
  viewModeLabel,
  periodLabel,
  selectedMunicipalityId,
  onSelect,
  onExport,
}: AccessibleDataTableProps) {
  const truncated = total > data.length;
  return (
    <div className="h-full overflow-auto px-4 pb-4 pt-20">
      {onExport ? (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-cyan-300/50 hover:text-cyan-200"
            onClick={onExport}
          >
            Exportar CSV ({total} linhas)
          </button>
        </div>
      ) : null}
      {truncated ? (
        <p className="mb-2 rounded border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs text-amber-100">
          Mostrando os {data.length} primeiros de {total} municipios. Selecione um estado para refinar.
        </p>
      ) : null}
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">
          {indicatorLabel} por municipio — {viewModeLabel}, periodo {periodLabel}.{" "}
          {truncated ? `Mostrando ${data.length} de ${total}` : `${data.length}`} municipios.
        </caption>
        <thead className="sticky top-20 bg-slate-950 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th scope="col" className="px-3 py-2">#</th>
            <th scope="col" className="px-3 py-2">Municipio</th>
            <th scope="col" className="px-3 py-2">UF</th>
            <th scope="col" className="px-3 py-2" aria-sort="descending">{viewModeLabel}</th>
            <th scope="col" className="px-3 py-2">Nivel</th>
            <th scope="col" className="px-3 py-2">Estado do dado</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td className="px-3 py-4 text-slate-400" colSpan={6}>
                Nenhum municipio no filtro atual.
              </td>
            </tr>
          ) : (
            data.map((item, index) => {
              const metric = item.indicadores[indicator];
              if (!metric) {
                return null;
              }
              const active = item.idIbge === selectedMunicipalityId;
              return (
                <tr
                  key={item.idIbge}
                  aria-current={active ? "true" : undefined}
                  className={active ? "bg-cyan-300/10" : "odd:bg-white/[0.02]"}
                >
                  <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                  <th scope="row" className="px-3 py-2 font-medium text-slate-100">
                    <button
                      type="button"
                      className="rounded text-left underline-offset-4 hover:text-cyan-200 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
                      onClick={() => onSelect(item)}
                    >
                      {item.municipio}
                    </button>
                  </th>
                  <td className="px-3 py-2 text-slate-300">{item.uf}</td>
                  <td className="px-3 py-2 text-slate-100">
                    {formatMetricValue(getMetricValue(item, indicator, viewMode), viewMode)}
                  </td>
                  <td className="px-3 py-2 text-slate-300">{riskLevelLabels[metric.nivel]}</td>
                  <td className="px-3 py-2 text-slate-400">{getDataStatusLabel(metric.dataStatus)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      {/* A mesma legenda de niveis do mapa, no fim da tabela (sem tapar linhas). */}
      <div className="mt-4">
        <MapLegend viewMode={viewMode} />
      </div>
    </div>
  );
}
