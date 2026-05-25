import { NextResponse } from "next/server";
import { demoDataStatus, mockCrimeData } from "@/data/mockCrimeData";
import type { CrimeIndicatorKey, ViewMode } from "@/types/crime";
import { getRankedMunicipalities } from "@/lib/ranking";

const validIndicators = new Set<CrimeIndicatorKey>([
  "indiceGeral",
  "homicidioDoloso",
  "feminicidio",
  "rouboVeiculos",
  "rouboCarga",
  "estupro",
  "traficoDrogas",
  "furtoVeiculos",
]);

const validModes = new Set<ViewMode>(["score", "total", "taxa100k", "variacaoMensal"]);

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("periodo") ?? "2026-04";
  const indicator = (searchParams.get("indicador") ?? "indiceGeral") as CrimeIndicatorKey;
  const mode = (searchParams.get("modo") ?? "score") as ViewMode;
  const uf = searchParams.get("uf");

  if (!validIndicators.has(indicator) || !validModes.has(mode)) {
    return NextResponse.json({ error: "Parametros invalidos" }, { status: 400 });
  }

  const items = mockCrimeData.filter((item) => item.periodo === period && (!uf || item.uf === uf));
  return NextResponse.json({
    demo: true,
    status: demoDataStatus,
    periodo: period,
    indicador: indicator,
    modo: mode,
    items,
    ranking: getRankedMunicipalities(items, indicator, mode, null, 10),
  });
}

