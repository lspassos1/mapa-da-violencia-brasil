import { LineChart, MapPinned } from "lucide-react";
import { formatDecimal, formatNumber } from "@/lib/formatters";
import { riskColors } from "@/lib/colorScale";
import { riskLevelLabels } from "@/lib/riskLevel";
import type { CrimeIndicatorKey, MunicipalityCrimeData, UfDatum } from "@/types/crime";

interface StateProfilePanelProps {
  uf: string;
  ufNome: string;
  indicatorLabel: string;
  periodLabel: string;
  // Registo do estado no periodo selecionado (null se nao existir na carga).
  current: UfDatum | null;
  // Serie completa do estado no indicador (ordenada por periodo asc).
  series: UfDatum[];
  // Posicao 1-based do estado entre as UFs com dados no periodo (por total).
  nationalRank: number;
  // Quantas UFs tem dados no periodo (denominador do ranking; nem sempre 27).
  nationalRankTotal: number;
  // Media nacional da taxa por 100 mil no periodo (null sem taxas).
  nationalAvgTaxa: number | null;
  // Top municipios do estado no indicador/periodo.
  topMunicipalities: MunicipalityCrimeData[];
  indicator: CrimeIndicatorKey;
  onSelectMunicipality: (item: MunicipalityCrimeData) => void;
}

// Mini-perfil do estado no painel direito: serie historica (sparkline),
// posicao no ranking nacional e distancia a media, e top municipios. Aparece
// quando ha um estado aberto sem municipio selecionado (indicador municipal).
export function StateProfilePanel({
  uf,
  ufNome,
  indicatorLabel,
  periodLabel,
  current,
  series,
  nationalRank,
  nationalRankTotal,
  nationalAvgTaxa,
  topMunicipalities,
  indicator,
  onSelectMunicipality,
}: StateProfilePanelProps) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4 backdrop-blur">
      <div className="flex items-center gap-2 text-sec">
        <MapPinned className="h-4 w-4" />
        <p className="text-xs uppercase tracking-[0.18em]">Perfil do estado</p>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-base font-semibold text-ink">{ufNome}</p>
        {current ? (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-bg0"
            style={{ background: riskColors[current.nivel] }}
          >
            {riskLevelLabels[current.nivel]}
          </span>
        ) : null}
      </div>
      <p className="text-[11px] text-ink0">
        {indicatorLabel} — {periodLabel}
      </p>

      {current ? (
        <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
          <div>
            <dt className="uppercase tracking-wide text-ink0">Total</dt>
            <dd className="text-sm font-semibold text-ink">{formatNumber(current.total)}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-wide text-ink0" title="Taxa por 100 mil">
              Taxa
            </dt>
            <dd className="text-sm font-semibold text-ink">
              {typeof current.taxa100k === "number" ? formatDecimal(current.taxa100k) : "—"}
            </dd>
          </div>
          <div>
            <dt
              className="uppercase tracking-wide text-ink0"
              title="Posicao entre as UFs com dados no periodo, ordenadas pelo total"
            >
              Ranking UF
            </dt>
            <dd className="text-sm font-semibold text-ink">
              {nationalRank > 0 && nationalRankTotal > 1 ? `${nationalRank}º/${nationalRankTotal}` : "—"}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-3 text-sm text-ter">Sem dados estaduais neste periodo.</p>
      )}

      {typeof current?.taxa100k === "number" && nationalAvgTaxa !== null ? (
        <p className="mt-2 text-[11px] leading-snug text-ter">
          Taxa {current.taxa100k >= nationalAvgTaxa ? "acima" : "abaixo"} da media nacional (
          {formatDecimal(nationalAvgTaxa)}/100 mil).
        </p>
      ) : null}

      {series.length > 1 ? (
        <div className="mt-4">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink0">
            <LineChart className="h-3.5 w-3.5" /> Serie {series[0].periodo}–{series[series.length - 1].periodo}{" "}
            (total)
          </div>
          <Sparkline series={series} />
        </div>
      ) : null}

      {topMunicipalities.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-ink0">
            Top municipios ({uf})
          </p>
          <ol className="space-y-1.5">
            {topMunicipalities.map((item, index) => {
              const metric = item.indicadores[indicator];
              return (
                <li key={item.idIbge}>
                  <button
                    type="button"
                    className="flex w-full items-baseline justify-between gap-2 rounded-md border border-line bg-panel/70 px-2.5 py-1.5 text-left text-sm transition hover:border-edge"
                    onClick={() => onSelectMunicipality(item)}
                  >
                    <span className="truncate text-ink">
                      <span className="mr-1.5 text-[11px] font-semibold text-ink0">#{index + 1}</span>
                      {item.municipio}
                    </span>
                    <span className="shrink-0 font-semibold text-ink">
                      {metric ? formatNumber(metric.total) : "—"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

// Sparkline SVG da serie de totais do estado (sem dependencias).
function Sparkline({ series }: { series: UfDatum[] }) {
  const width = 280;
  const height = 56;
  const pad = 4;
  const totals = series.map((datum) => datum.total);
  const max = Math.max(...totals, 1);
  const min = Math.min(...totals);
  const x = (index: number) =>
    pad + (series.length > 1 ? (index / (series.length - 1)) * (width - pad * 2) : (width - pad * 2) / 2);
  const y = (value: number) =>
    max === min ? height / 2 : pad + (1 - (value - min) / (max - min)) * (height - pad * 2);
  const path = totals
    .map((value, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(value).toFixed(1)}`)
    .join(" ");
  const last = totals[totals.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label={`Serie de totais: minimo ${formatNumber(min)}, maximo ${formatNumber(max)}, atual ${formatNumber(last)}`}
    >
      <path d={path} fill="none" stroke="#22d3ee" strokeWidth="1.8" />
      <circle cx={x(totals.length - 1)} cy={y(last)} r="3" fill="#22d3ee">
        <title>{`${series[series.length - 1].periodo}: ${formatNumber(last)}`}</title>
      </circle>
    </svg>
  );
}
