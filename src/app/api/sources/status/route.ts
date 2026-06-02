import { NextResponse } from "next/server";
import { getDemoDataStatus } from "@/services/crimeDataService";
import { getNewsDataStatus } from "@/services/newsIncidentService";

export function GET() {
  const officialStatus = getDemoDataStatus();
  const newsStatus = getNewsDataStatus();

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
      {
        id: "news_osint_demo",
        nome: newsStatus.source,
        status: "osint_demo",
        unidade: null,
        ultimaAtualizacao: newsStatus.lastUpdated,
        ultimoPeriodoDisponivel: newsStatus.latestPeriod,
        limitacoes: [
          "Noticias OSINT demonstrativas ficam separadas dos dados oficiais e nao entram em ranking ou score.",
        ],
      },
    ],
  });
}
