import { Download } from "lucide-react";
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
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:border-edgehover hover:text-ink"
            onClick={onExport}
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV ({total} linhas)
          </button>
        </div>
      ) : null}
      {truncated ? (
        <p className="mb-2 rounded border border-edge bg-[rgba(86,91,99,.15)] px-3 py-1.5 text-xs text-sec">
          Mostrando os {data.length} primeiros de {total} municipios. Selecione um estado para refinar.
        </p>
      ) : null}
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">
          {indicatorLabel} por municipio — {viewModeLabel}, periodo {periodLabel}.{" "}
          {truncated ? `Mostrando ${data.length} de ${total}` : `${data.length}`} municipios.
        </caption>
        <thead className="sticky top-[92px] bg-panel text-xs uppercase tracking-wide text-ter">
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
              <td className="px-3 py-4 text-ter" colSpan={6}>
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
                  className={active ? "bg-[rgba(236,234,228,.07)]" : "odd:bg-panel"}
                >
                  <td className="px-3 py-2 text-quat">{index + 1}</td>
                  <th scope="row" className="px-3 py-2 font-medium text-ink">
                    <button
                      type="button"
                      className="rounded text-left underline-offset-4 hover:text-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
                      onClick={() => onSelect(item)}
                    >
                      {item.municipio}
                    </button>
                  </th>
                  <td className="px-3 py-2 text-sec">{item.uf}</td>
                  <td className="px-3 py-2 text-ink">
                    {formatMetricValue(getMetricValue(item, indicator, viewMode), viewMode)}
                  </td>
                  <td className="px-3 py-2 text-sec">{riskLevelLabels[metric.nivel]}</td>
                  <td className="px-3 py-2 text-ter">{getDataStatusLabel(metric.dataStatus)}</td>
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
