import { NextResponse } from "next/server";
import { getServerCrimeDataApi } from "@/services/crimeDataService.server";

export async function GET() {
  const metadata = (await getServerCrimeDataApi()).getCrimeMetadata();

  return NextResponse.json({
    indicadores: metadata.indicators,
    periodos: metadata.periods,
    ufs: metadata.ufs,
    modos: metadata.viewModes,
    filtrosPadrao: metadata.defaultFilters,
    modoDados: metadata.dataMode,
    escopo: metadata.scope,
  });
}
