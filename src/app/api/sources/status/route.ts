import { NextResponse } from "next/server";
import { getServerCrimeDataApi } from "@/services/crimeDataService.server";

export async function GET() {
  const officialStatus = (await getServerCrimeDataApi()).getDemoDataStatus();

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
