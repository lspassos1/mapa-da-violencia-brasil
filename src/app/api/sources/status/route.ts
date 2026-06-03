import { NextResponse } from "next/server";
import { getDemoDataStatus } from "@/services/crimeDataService";

export function GET() {
  const officialStatus = getDemoDataStatus();

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
