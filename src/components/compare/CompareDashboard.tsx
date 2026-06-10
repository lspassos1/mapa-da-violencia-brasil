"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, GitCompareArrows } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { riskColors } from "@/lib/colorScale";
import { formatDecimal, formatNumber } from "@/lib/formatters";
import { riskLevelLabels } from "@/lib/riskLevel";
import { isRemoteDataMode } from "@/lib/dataMode";
import { getStaticCrimeDataApi, loadCrimeDataApi, type CrimeDataApi } from "@/services/crimeDataService";
import type { CrimeIndicatorKey, UfDatum } from "@/types/crime";

// Paleta fixa para ate 4 estados comparados (consistente entre grafico/cartoes).
const UF_COLORS = ["#22d3ee", "#fbbf24", "#34d399", "#e879f9"];
const MAX_UFS = 4;

type CompareMode = "score" | "total" | "taxa100k";

const MODE_OPTIONS: Array<{ key: CompareMode; label: string }> = [
  { key: "score", label: "Indice 0-100" },
  { key: "total", label: "Total" },
  { key: "taxa100k", label: "Taxa por 100 mil" },
];

function valueOf(datum: UfDatum | null | undefined, mode: CompareMode): number | null {
  if (!datum) {
    return null;
  }
  if (mode === "total") return datum.total;
  if (mode === "taxa100k") return datum.taxa100k;
  return datum.score;
}

function formatValue(value: number | null, mode: CompareMode): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }
  if (mode === "total") return formatNumber(value);
  if (mode === "taxa100k") return formatDecimal(value);
  return `${Math.round(value)}/100`;
}

export function CompareDashboard() {
  const [api, setApi] = useState<CrimeDataApi | null>(
    isRemoteDataMode() ? null : getStaticCrimeDataApi(),
  );

  useEffect(() => {
    let active = true;
    loadCrimeDataApi().then((loaded) => {
      if (active) {
        setApi(loaded);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (!api) {
    return (
      <main className="flex min-h-screen flex-col text-slate-100">
        <AppHeader />
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-slate-400" role="status" aria-live="polite">
          A carregar a carga nacional…
        </div>
      </main>
    );
  }

  return <CompareView api={api} />;
}

function CompareView({ api }: { api: CrimeDataApi }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const indicators = api.getAvailableIndicators();
  const periods = api.getAvailablePeriods();
  const metadata = api.getCrimeMetadata();
  const nameByUf = new Map(metadata.ufs.map((entry) => [entry.uf, entry.nome]));
  const allUfs = metadata.ufs;

  const defaultIndicator = indicators[0]?.key ?? "indiceGeral";
  const defaultPeriod = periods[0]?.key ?? "2026";

  // Estado inicial a partir da URL (deep-link); validado contra o catalogo.
  const [ufs, setUfs] = useState<string[]>(() => {
    const raw = (searchParams.get("ufs") ?? "SP,RJ").split(",").map((u) => u.trim().toUpperCase());
    const known = new Set(allUfs.map((entry) => entry.uf));
    const valid = raw.filter((uf) => known.has(uf));
    return (valid.length > 0 ? valid : ["SP", "RJ"]).slice(0, MAX_UFS);
  });
  const [indicator, setIndicator] = useState<CrimeIndicatorKey>(() => {
    const raw = searchParams.get("indicador") ?? "";
    return api.isCrimeIndicatorKey(raw) ? raw : defaultIndicator;
  });
  const [mode, setMode] = useState<CompareMode>(() => {
    const raw = searchParams.get("modo") ?? "";
    return MODE_OPTIONS.some((option) => option.key === raw) ? (raw as CompareMode) : "taxa100k";
  });
  const [period, setPeriod] = useState<string>(() => {
    const raw = searchParams.get("periodo") ?? "";
    return periods.some((option) => option.key === raw) ? raw : defaultPeriod;
  });

  // Reflete os filtros na URL para a vista ser partilhavel.
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("ufs", ufs.join(","));
    params.set("indicador", indicator);
    params.set("modo", mode);
    params.set("periodo", period);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [ufs, indicator, mode, period, pathname, router]);

  const indicatorLabel = indicators.find((option) => option.key === indicator)?.label ?? indicator;
  const periodLabel = periods.find((option) => option.key === period)?.label ?? period;

  // Serie do indicador por (uf, periodo) para o grafico e cartoes.
  const ufSeries = api.getUfIndicatorData(indicator);
  const byUfPeriod = new Map(ufSeries.map((datum) => [`${datum.uf}|${datum.periodo}`, datum]));
  const periodsAsc = [...periods].sort((a, b) => a.key.localeCompare(b.key));

  function toggleUf(uf: string) {
    setUfs((current) => {
      if (current.includes(uf)) {
        return current.length > 1 ? current.filter((entry) => entry !== uf) : current;
      }
      return current.length >= MAX_UFS ? current : [...current, uf];
    });
  }

  return (
    <main className="flex min-h-screen flex-col text-slate-100">
      <AppHeader />
      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 p-4 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <GitCompareArrows className="h-5 w-5 text-cyan-300" />
            <h2 className="text-lg font-semibold">Comparar estados</h2>
          </div>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-cyan-200">
            <ArrowLeft className="h-4 w-4" /> Voltar ao mapa
          </Link>
        </div>

        {/* Selecao de estados (2-4) */}
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <p className="mb-3 text-xs uppercase tracking-[0.16em] text-slate-400">
            Estados ({ufs.length}/{MAX_UFS})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {allUfs.map((entry) => {
              const selected = ufs.includes(entry.uf);
              const disabled = !selected && ufs.length >= MAX_UFS;
              const colorIndex = ufs.indexOf(entry.uf);
              return (
                <button
                  key={entry.uf}
                  type="button"
                  aria-pressed={selected}
                  disabled={disabled}
                  title={entry.nome}
                  onClick={() => toggleUf(entry.uf)}
                  className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition ${
                    selected
                      ? "border-transparent text-slate-950"
                      : disabled
                        ? "cursor-not-allowed border-white/5 text-slate-600"
                        : "border-white/10 text-slate-300 hover:border-cyan-300/40"
                  }`}
                  style={selected ? { background: UF_COLORS[colorIndex] } : undefined}
                >
                  {entry.uf}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filtros */}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Indicador</span>
            <select
              className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2"
              value={indicator}
              onChange={(event) => setIndicator(event.target.value as CrimeIndicatorKey)}
            >
              {indicators.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Metrica</span>
            <select
              className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2"
              value={mode}
              onChange={(event) => setMode(event.target.value as CompareMode)}
            >
              {MODE_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Periodo (cartoes/tabela)</span>
            <select
              className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
            >
              {periods.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Cartoes por estado */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ufs.map((uf, index) => {
            const datum = byUfPeriod.get(`${uf}|${period}`);
            return (
              <article key={uf} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold" style={{ color: UF_COLORS[index] }}>
                    {nameByUf.get(uf) ?? uf}
                  </p>
                  {datum ? (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-slate-950"
                      style={{ background: riskColors[datum.nivel] }}
                    >
                      {riskLevelLabels[datum.nivel]}
                    </span>
                  ) : null}
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <dt className="uppercase tracking-wide text-slate-500">Indice</dt>
                    <dd className="text-sm font-semibold text-slate-100">{formatValue(valueOf(datum, "score"), "score")}</dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-wide text-slate-500">Total</dt>
                    <dd className="text-sm font-semibold text-slate-100">{formatValue(valueOf(datum, "total"), "total")}</dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-wide text-slate-500" title="Taxa por 100 mil">Taxa</dt>
                    <dd className="text-sm font-semibold text-slate-100">
                      {formatValue(valueOf(datum, "taxa100k"), "taxa100k")}
                    </dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>

        {/* Serie historica sobreposta */}
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <p className="mb-1 text-xs uppercase tracking-[0.16em] text-slate-400">
            {indicatorLabel} — {MODE_OPTIONS.find((option) => option.key === mode)?.label} por ano
          </p>
          <UfSeriesChart
            ufs={ufs}
            periods={periodsAsc.map((option) => option.key)}
            periodLabels={periodsAsc.map((option) => option.label)}
            byUfPeriod={byUfPeriod}
            mode={mode}
          />
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-300">
            {ufs.map((uf, index) => (
              <span key={uf} className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: UF_COLORS[index] }} />
                {nameByUf.get(uf) ?? uf}
              </span>
            ))}
          </div>
        </div>

        {/* Tabela: todos os indicadores no periodo selecionado */}
        <div className="overflow-x-auto rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <p className="mb-3 text-xs uppercase tracking-[0.16em] text-slate-400">
            Todos os indicadores — {MODE_OPTIONS.find((option) => option.key === mode)?.label}, {periodLabel}
          </p>
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">
              Comparacao de {ufs.length} estados em todos os indicadores, periodo {periodLabel}.
            </caption>
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th scope="col" className="px-3 py-2">Indicador</th>
                {ufs.map((uf, index) => (
                  <th key={uf} scope="col" className="px-3 py-2" style={{ color: UF_COLORS[index] }}>
                    {uf}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {indicators.map((option) => {
                const values = ufs.map((uf) => valueOf(api.getUfDatum(uf, period, option.key), mode));
                const finite = values.filter((value): value is number => value !== null && Number.isFinite(value));
                const best = finite.length > 1 ? Math.min(...finite) : null;
                const worst = finite.length > 1 ? Math.max(...finite) : null;
                return (
                  <tr key={option.key} className="odd:bg-white/[0.02]">
                    <th scope="row" className="px-3 py-2 font-medium text-slate-200">
                      {option.label}
                    </th>
                    {values.map((value, index) => {
                      const isBest = value !== null && value === best && best !== worst;
                      const isWorst = value !== null && value === worst && best !== worst;
                      return (
                        <td
                          key={ufs[index]}
                          className={`px-3 py-2 ${
                            isBest ? "font-semibold text-emerald-300" : isWorst ? "font-semibold text-red-300" : "text-slate-100"
                          }`}
                        >
                          {formatValue(value, mode)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-slate-500">
            Verde = menor valor (melhor); vermelho = maior valor (pior) entre os estados selecionados.
          </p>
        </div>
      </section>
    </main>
  );
}

// Grafico de linhas SVG (sem dependencias): uma linha por UF ao longo dos anos.
function UfSeriesChart({
  ufs,
  periods,
  periodLabels,
  byUfPeriod,
  mode,
}: {
  ufs: string[];
  periods: string[];
  periodLabels: string[];
  byUfPeriod: Map<string, UfDatum>;
  mode: CompareMode;
}) {
  const width = 760;
  const height = 260;
  const margin = { top: 12, right: 16, bottom: 28, left: 56 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const allValues = ufs.flatMap((uf) =>
    periods.map((period) => valueOf(byUfPeriod.get(`${uf}|${period}`), mode)),
  );
  const finite = allValues.filter((value): value is number => value !== null && Number.isFinite(value));
  const maxValue = finite.length > 0 ? Math.max(...finite, 1) : 1;

  const x = (index: number) =>
    margin.left + (periods.length > 1 ? (index / (periods.length - 1)) * innerWidth : innerWidth / 2);
  const y = (value: number) => margin.top + innerHeight - (value / maxValue) * innerHeight;

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((fraction) => ({
    value: maxValue * fraction,
    yPos: y(maxValue * fraction),
  }));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label={`Serie historica por estado (${periods[0]}–${periods[periods.length - 1]})`}
    >
      {gridLines.map((line) => (
        <g key={line.value}>
          <line x1={margin.left} x2={width - margin.right} y1={line.yPos} y2={line.yPos} stroke="rgba(255,255,255,0.08)" />
          <text x={margin.left - 8} y={line.yPos + 3} textAnchor="end" fontSize="10" fill="#64748b">
            {mode === "taxa100k" ? formatDecimal(line.value) : formatNumber(Math.round(line.value))}
          </text>
        </g>
      ))}
      {periods.map((period, index) => (
        <text
          key={period}
          x={x(index)}
          y={height - 8}
          textAnchor="middle"
          fontSize="10"
          fill={periodLabels[index]?.includes("parcial") ? "#f59e0b" : "#64748b"}
        >
          {period}
        </text>
      ))}
      {ufs.map((uf, ufIndex) => {
        const points = periods
          .map((period, index) => ({ index, value: valueOf(byUfPeriod.get(`${uf}|${period}`), mode) }))
          .filter((point): point is { index: number; value: number } => point.value !== null && Number.isFinite(point.value));
        if (points.length === 0) {
          return null;
        }
        const path = points
          .map((point, order) => `${order === 0 ? "M" : "L"}${x(point.index).toFixed(1)},${y(point.value).toFixed(1)}`)
          .join(" ");
        return (
          <g key={uf}>
            <path d={path} fill="none" stroke={UF_COLORS[ufIndex]} strokeWidth="2" />
            {points.map((point) => (
              <circle key={point.index} cx={x(point.index)} cy={y(point.value)} r="3" fill={UF_COLORS[ufIndex]}>
                <title>{`${uf} ${periods[point.index]}: ${formatValue(point.value, mode)}`}</title>
              </circle>
            ))}
          </g>
        );
      })}
    </svg>
  );
}
