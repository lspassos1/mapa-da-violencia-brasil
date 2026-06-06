import { NextResponse } from "next/server";
import { getServerCrimeDataApi } from "@/services/crimeDataService.server";

export function GET() {
  const officialStatus = getServerCrimeDataApi().getDemoDataStatus();

  return NextResponse.json({
    fontes: [
      {
        id: officialStatus.sourceId ?? "crime_data",
        nome: officialStatus.source,
        status: officialStatus.mode ?? "demo",
        unidade: officialStatus.unit ?? null,
        ultimaAtualizacao: officialStatus.lastUpdated,
        ultimoPeriodoDisponivel: officialStatus.latestPeriod,
        limitacoes: officialStatus.limitations ?? [],
      },
    ],
  });
}
