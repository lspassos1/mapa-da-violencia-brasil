import { NextResponse } from "next/server";
import { getCrimeMetadata } from "@/services/crimeDataService";

export function GET() {
  const metadata = getCrimeMetadata();

  return NextResponse.json({
    indicadores: metadata.indicators,
    periodos: metadata.periods,
    ufs: metadata.ufs,
    modos: metadata.viewModes,
    filtrosPadrao: metadata.defaultFilters,
    modoDados: metadata.dataMode,
  });
}
