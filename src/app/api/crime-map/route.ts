import { NextResponse } from "next/server";
import { getServerCrimeDataApi } from "@/services/crimeDataService.server";

export async function GET(request: Request) {
  const api = await getServerCrimeDataApi();
  const { searchParams } = new URL(request.url);
  const defaults = api.getDefaultCrimeMapFilters();
  const period = searchParams.get("periodo") ?? searchParams.get("period") ?? defaults.period;
  const indicatorParam = searchParams.get("indicador") ?? searchParams.get("indicator") ?? defaults.indicator;
  const modeParam = searchParams.get("modo") ?? searchParams.get("viewMode") ?? searchParams.get("mode") ?? defaults.viewMode;
  const uf = searchParams.get("uf");

  if (!api.isCrimeIndicatorKey(indicatorParam) || !api.isViewMode(modeParam)) {
    return NextResponse.json({ error: "Parametros invalidos" }, { status: 400 });
  }

  const result = api.getCrimeMapData({
    indicator: indicatorParam,
    period,
    viewMode: modeParam,
    uf,
  });

  return NextResponse.json({
    ...result,
    periodo: result.filters.period,
    indicador: result.filters.indicator,
    modo: result.filters.viewMode,
    fonteResumo: {
      nome: result.status.source,
      ultimaAtualizacao: result.status.lastUpdated,
      ultimoPeriodoDisponivel: result.status.latestPeriod,
      unidade: result.status.unit ?? null,
      modo: result.status.mode ?? "demo",
    },
    metadata: api.getCrimeMetadata(),
  });
}
