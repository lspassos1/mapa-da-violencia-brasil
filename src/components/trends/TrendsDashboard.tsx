"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TrendingDown, TrendingUp, LineChart } from "lucide-react";
import { BackLink } from "@/components/layout/BackLink";
import { formatDecimal, formatNumber } from "@/lib/formatters";
import { loadTrendsData, type TrendsData } from "@/services/trendsService";

// A pagina de tendencias carrega APENAS o dataset mensal agregado (~dezenas de
// KB), sem a carga municipal — por isso os catalogos (labels) sao constantes
// locais, estaveis e alinhadas com o catalogo principal.
const INDICATOR_LABELS: Array<{ key: string; label: string }> = [
  { key: "indiceGeral", label: "Indice geral (todos os crimes)" },
  { key: "homicidioDoloso", label: "Homicidio doloso" },
  { key: "feminicidio", label: "Feminicidio" },
  { key: "latrocinio", label: "Latrocinio" },
  { key: "lesaoCorporalMorte", label: "Lesao corporal seguida de morte" },
  { key: "tentativaHomicidio", label: "Tentativa de homicidio" },
  { key: "morteIntervencaoEstado", label: "Morte por intervencao do Estado" },
  { key: "estupro", label: "Estupro" },
  { key: "estuproVulneravel", label: "Estupro de vulneravel" },
  { key: "rouboVeiculos", label: "Roubo de veiculos" },
  { key: "furtoVeiculos", label: "Furto de veiculos" },
  { key: "rouboCarga", label: "Roubo de carga" },
  { key: "rouboInstituicaoFinanceira", label: "Roubo a instituicao financeira" },
  { key: "traficoDrogas", label: "Trafico de drogas" },
];

const NIVEIS: Array<{ key: string; label: string }> = [
  { key: "BR", label: "Brasil (nacional)" },
  { key: "AC", label: "Acre" }, { key: "AL", label: "Alagoas" }, { key: "AP", label: "Amapa" },
  { key: "AM", label: "Amazonas" }, { key: "BA", label: "Bahia" }, { key: "CE", label: "Ceara" },
  { key: "DF", label: "Distrito Federal" }, { key: "ES", label: "Espirito Santo" },
  { key: "GO", label: "Goias" }, { key: "MA", label: "Maranhao" }, { key: "MT", label: "Mato Grosso" },
  { key: "MS", label: "Mato Grosso do Sul" }, { key: "MG", label: "Minas Gerais" },
  { key: "PA", label: "Para" }, { key: "PB", label: "Paraiba" }, { key: "PR", label: "Parana" },
  { key: "PE", label: "Pernambuco" }, { key: "PI", label: "Piaui" }, { key: "RJ", label: "Rio de Janeiro" },
  { key: "RN", label: "Rio Grande do Norte" }, { key: "RS", label: "Rio Grande do Sul" },
  { key: "RO", label: "Rondonia" }, { key: "RR", label: "Roraima" }, { key: "SC", label: "Santa Catarina" },
  { key: "SP", label: "Sao Paulo" }, { key: "SE", label: "Sergipe" }, { key: "TO", label: "Tocantins" },
];

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
// Anos no grafico mensal: mais recente em destaque, anteriores atenuados.
const YEAR_COLORS = ["#22d3ee", "#94a3b8", "#fbbf24", "#34d399", "#e879f9", "#f87171"];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function TrendsDashboard() {
  const [data, setData] = useState<TrendsData | null>(null);

  useEffect(() => {
    let active = true;
    loadTrendsData().then((loaded) => {
      if (active) {
        setData(loaded);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-ter" role="status" aria-live="polite">
        A carregar as series mensais…
      </div>
    );
  }

  if (data.series.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <p className="rounded-lg border border-edge bg-[rgba(86,91,99,.12)] p-4 text-sm text-sec" role="status">
          Series mensais indisponiveis nesta carga. Gere o dataset com
          {" "}<code>python3 -m etl.aggregate_vde build-trends</code> e publique
          {" "}<code>public/trendsData.json.gz</code>.
        </p>
      </div>
    );
  }

  return <TrendsView data={data} />;
}

function TrendsView({ data }: { data: TrendsData }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [indicator, setIndicator] = useState<string>(() => {
    const raw = searchParams.get("indicador") ?? "";
    return INDICATOR_LABELS.some((option) => option.key === raw) ? raw : "indiceGeral";
  });
  const [nivel, setNivel] = useState<string>(() => {
    const raw = (searchParams.get("nivel") ?? "BR").toUpperCase();
    return NIVEIS.some((option) => option.key === raw) ? raw : "BR";
  });
  // 0 e a sentinela de "todos os anos" (sem limite) — nao um numero fixo que
  // truncaria silenciosamente quando a serie passar de 12 anos.
  const [yearWindow, setYearWindow] = useState<number>(() => {
    const raw = Number.parseInt(searchParams.get("anos") ?? "3", 10);
    return [3, 5, 0].includes(raw) ? raw : 3;
  });

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("indicador", indicator);
    params.set("nivel", nivel);
    params.set("anos", String(yearWindow));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [indicator, nivel, yearWindow, pathname, router]);

  const serie = data.series.find((entry) => entry.nivel === nivel && entry.indicador === indicator);
  const valores = serie?.valores ?? {};

  // Totais por ano e meses presentes por ano (para o like-for-like do parcial).
  const byYear = new Map<number, Map<number, number>>();
  for (const [periodo, total] of Object.entries(valores)) {
    const year = Number.parseInt(periodo.slice(0, 4), 10);
    const month = Number.parseInt(periodo.slice(5, 7), 10);
    if (!byYear.has(year)) {
      byYear.set(year, new Map());
    }
    byYear.get(year)!.set(month, total);
  }
  const years = [...byYear.keys()].sort((a, b) => a - b);

  // Combinacao nivel/indicador sem dados: sai cedo (depois de todos os hooks)
  // com uma mensagem clara, em vez de KPIs com "undefined"/NaN.
  if (years.length === 0) {
    return (
      <section className="mx-auto w-full max-w-3xl p-6">
        <p className="rounded-lg border border-line bg-cellhead p-4 text-sm text-sec" role="status">
          Sem serie mensal para esta combinacao de indicador e abrangencia.
        </p>
      </section>
    );
  }

  const latestYear = years[years.length - 1];
  const latestMonths = latestYear ? [...byYear.get(latestYear)!.keys()].sort((a, b) => a - b) : [];
  const isPartial = data.partialYears.includes(latestYear);

  // KPI: total do ano corrente, media/dia e variacao like-for-like (mesmos
  // meses do ano anterior) — o padrao honesto do dashboard SINESP.
  const latestTotal = latestMonths.reduce((sum, month) => sum + (byYear.get(latestYear)!.get(month) ?? 0), 0);
  const prevSameMonths = latestYear
    ? latestMonths.reduce((sum, month) => sum + (byYear.get(latestYear - 1)?.get(month) ?? 0), 0)
    : 0;
  const variation = prevSameMonths > 0 ? ((latestTotal - prevSameMonths) / prevSameMonths) * 100 : null;
  const elapsedDays = latestMonths.reduce((sum, month) => sum + daysInMonth(latestYear, month), 0);
  const perDay = elapsedDays > 0 ? latestTotal / elapsedDays : null;
  const monthSpanLabel =
    latestMonths.length > 0
      ? `${MONTH_LABELS[latestMonths[0] - 1]}–${MONTH_LABELS[latestMonths[latestMonths.length - 1] - 1]}`
      : "";

  const indicatorLabel = INDICATOR_LABELS.find((option) => option.key === indicator)?.label ?? indicator;
  const nivelLabel = NIVEIS.find((option) => option.key === nivel)?.label ?? nivel;
  const chartYears = yearWindow === 0 ? years : years.slice(-yearWindow);

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <LineChart className="h-5 w-5 text-sec" />
          <h2 className="text-lg font-semibold">Tendências</h2>
        </div>
        <BackLink href="/mapa">Voltar ao mapa</BackLink>
      </div>

      {/* Filtros */}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-ter">Indicador</span>
          <select
            className="w-full rounded-lg border border-line bg-panel px-3 py-2"
            value={indicator}
            onChange={(event) => setIndicator(event.target.value)}
          >
            {INDICATOR_LABELS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-ter">Abrangencia</span>
          <select
            className="w-full rounded-lg border border-line bg-panel px-3 py-2"
            value={nivel}
            onChange={(event) => setNivel(event.target.value)}
          >
            {NIVEIS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-ter">Anos no grafico</span>
          <select
            className="w-full rounded-lg border border-line bg-panel px-3 py-2"
            value={yearWindow}
            onChange={(event) => setYearWindow(Number.parseInt(event.target.value, 10))}
          >
            <option value={3}>Ultimos 3</option>
            <option value={5}>Ultimos 5</option>
            <option value={0}>Todos</option>
          </select>
        </label>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-lg border border-line bg-cellhead p-4">
          <p className="text-xs uppercase tracking-wide text-ter">
            Total {latestYear}
            {isPartial ? ` (${monthSpanLabel})` : ""}
          </p>
          <p className="mt-1 text-2xl font-semibold text-ink">{formatNumber(latestTotal)}</p>
        </article>
        <article className="rounded-lg border border-line bg-cellhead p-4">
          <p className="text-xs uppercase tracking-wide text-ter">Media por dia</p>
          <p className="mt-1 text-2xl font-semibold text-ink">
            {perDay !== null ? formatDecimal(perDay) : "—"}
          </p>
        </article>
        <article className="rounded-lg border border-line bg-cellhead p-4">
          <p className="text-xs uppercase tracking-wide text-ter">
            Variacao {latestYear - 1}/{latestYear} ({monthSpanLabel})
          </p>
          <p
            className={`mt-1 inline-flex items-center gap-1.5 text-2xl font-semibold ${
              variation === null || variation === 0
                ? "text-ink"
                : variation > 0
                  ? "text-[#E5533D]"
                  : "text-positivo"
            }`}
          >
            {variation === null ? (
              "—"
            ) : (
              <>
                {variation > 0 ? (
                  <TrendingUp className="h-5 w-5" />
                ) : variation < 0 ? (
                  <TrendingDown className="h-5 w-5" />
                ) : null}
                {variation > 0 ? "+" : ""}
                {formatDecimal(variation)}%
              </>
            )}
          </p>
          <p className="mt-1 text-[11px] text-ink0">Mesmos meses nos dois anos (like-for-like).</p>
        </article>
      </div>

      {/* Linhas mensais sobrepostas por ano (sazonalidade) */}
      <div className="rounded-lg border border-line bg-cellhead p-4">
        <p className="mb-1 text-xs uppercase tracking-[0.16em] text-ter">
          {indicatorLabel} por mes — {nivelLabel}
        </p>
        <MonthlyChart byYear={byYear} chartYears={chartYears} partialYears={data.partialYears} />
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-sec">
          {chartYears.map((year, index) => (
            <span key={year} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: YEAR_COLORS[(chartYears.length - 1 - index) % YEAR_COLORS.length] }}
              />
              {year}
              {data.partialYears.includes(year) ? " (parcial)" : ""}
            </span>
          ))}
        </div>
      </div>

      {/* Barras anuais */}
      <div className="rounded-lg border border-line bg-cellhead p-4">
        <p className="mb-1 text-xs uppercase tracking-[0.16em] text-ter">
          Total por ano — {nivelLabel}
        </p>
        <YearBars byYear={byYear} years={years} partialYears={data.partialYears} />
        {data.partialYears.length > 0 ? (
          <p className="mt-2 text-[11px] text-ter">
            *{data.partialYears.join(", ")}: ano parcial ({monthSpanLabel}).
          </p>
        ) : null}
      </div>
    </section>
  );
}

function MonthlyChart({
  byYear,
  chartYears,
  partialYears,
}: {
  byYear: Map<number, Map<number, number>>;
  chartYears: number[];
  partialYears: number[];
}) {
  const width = 760;
  const height = 260;
  const margin = { top: 12, right: 16, bottom: 26, left: 56 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const allValues = chartYears.flatMap((year) => [...(byYear.get(year)?.values() ?? [])]);
  const maxValue = allValues.length > 0 ? Math.max(...allValues, 1) : 1;
  const x = (month: number) => margin.left + ((month - 1) / 11) * innerWidth;
  const y = (value: number) => margin.top + innerHeight - (value / maxValue) * innerHeight;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Serie mensal sobreposta por ano">
      {[0, 0.5, 1].map((fraction) => (
        <g key={fraction}>
          <line
            x1={margin.left}
            x2={width - margin.right}
            y1={y(maxValue * fraction)}
            y2={y(maxValue * fraction)}
            stroke="rgba(255,255,255,0.08)"
          />
          <text x={margin.left - 8} y={y(maxValue * fraction) + 3} textAnchor="end" fontSize="10" fill="#64748b">
            {formatNumber(Math.round(maxValue * fraction))}
          </text>
        </g>
      ))}
      {MONTH_LABELS.map((label, index) => (
        <text key={label} x={x(index + 1)} y={height - 6} textAnchor="middle" fontSize="10" fill="#64748b">
          {label}
        </text>
      ))}
      {chartYears.map((year, index) => {
        const months = byYear.get(year);
        if (!months) {
          return null;
        }
        const color = YEAR_COLORS[(chartYears.length - 1 - index) % YEAR_COLORS.length];
        const points = [...months.entries()].sort((a, b) => a[0] - b[0]);
        const path = points
          .map(([month, value], order) => `${order === 0 ? "M" : "L"}${x(month).toFixed(1)},${y(value).toFixed(1)}`)
          .join(" ");
        return (
          <g key={year}>
            <path d={path} fill="none" stroke={color} strokeWidth={index === chartYears.length - 1 ? 2.5 : 1.8} />
            {points.map(([month, value]) => (
              <circle key={month} cx={x(month)} cy={y(value)} r="2.6" fill={color}>
                <title>{`${MONTH_LABELS[month - 1]}/${year}${partialYears.includes(year) ? " (parcial)" : ""}: ${formatNumber(value)}`}</title>
              </circle>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function YearBars({
  byYear,
  years,
  partialYears,
}: {
  byYear: Map<number, Map<number, number>>;
  years: number[];
  partialYears: number[];
}) {
  const width = 760;
  const height = 200;
  const margin = { top: 12, right: 16, bottom: 26, left: 56 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const totals = years.map((year) => ({
    year,
    total: [...(byYear.get(year)?.values() ?? [])].reduce((sum, value) => sum + value, 0),
  }));
  const maxTotal = Math.max(...totals.map((entry) => entry.total), 1);
  const band = innerWidth / Math.max(totals.length, 1);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Total por ano">
      {totals.map((entry, index) => {
        const barHeight = (entry.total / maxTotal) * innerHeight;
        const partial = partialYears.includes(entry.year);
        return (
          <g key={entry.year}>
            <rect
              x={margin.left + index * band + band * 0.15}
              y={margin.top + innerHeight - barHeight}
              width={band * 0.7}
              height={barHeight}
              rx="3"
              fill={partial ? "#f59e0b" : "#22d3ee"}
              opacity={partial ? 0.75 : 0.85}
            >
              <title>{`${entry.year}${partial ? " (parcial)" : ""}: ${formatNumber(entry.total)}`}</title>
            </rect>
            <text
              x={margin.left + index * band + band / 2}
              y={height - 8}
              textAnchor="middle"
              fontSize="10"
              fill={partial ? "#f59e0b" : "#64748b"}
            >
              {String(entry.year).slice(2)}
            </text>
          </g>
        );
      })}
      <text x={margin.left - 8} y={margin.top + 4} textAnchor="end" fontSize="10" fill="#64748b">
        {formatNumber(maxTotal)}
      </text>
    </svg>
  );
}
