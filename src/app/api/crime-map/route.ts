import { NextResponse } from "next/server";
import {
  getCrimeMapData,
  getDefaultCrimeMapFilters,
  isCrimeIndicatorKey,
  isViewMode,
} from "@/services/crimeDataService";

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const defaults = getDefaultCrimeMapFilters();
  const period = searchParams.get("periodo") ?? defaults.period;
  const indicatorParam = searchParams.get("indicador") ?? defaults.indicator;
  const modeParam = searchParams.get("modo") ?? defaults.viewMode;
  const uf = searchParams.get("uf");

  if (!isCrimeIndicatorKey(indicatorParam) || !isViewMode(modeParam)) {
    return NextResponse.json({ error: "Parametros invalidos" }, { status: 400 });
  }

  const result = getCrimeMapData({
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
  });
}
