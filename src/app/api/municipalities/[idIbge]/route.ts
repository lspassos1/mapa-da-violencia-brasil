import { NextResponse } from "next/server";
import {
  getCrimeMetadata,
  getDefaultCrimeMapFilters,
  getDemoDataStatus,
  getMunicipalityById,
} from "@/services/crimeDataService";

export async function GET(
  request: Request,
  context: { params: Promise<{ idIbge: string }> },
) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("periodo") ?? searchParams.get("period") ?? getDefaultCrimeMapFilters().period;
  const { idIbge } = await context.params;
  const item = getMunicipalityById(idIbge, period);

  if (!item) {
    return NextResponse.json({ error: "Municipio nao encontrado" }, { status: 404 });
  }

  const status = getDemoDataStatus();
  const metadata = getCrimeMetadata();

  return NextResponse.json({
    demo: metadata.dataMode === "demo",
    status,
    item,
  });
}
