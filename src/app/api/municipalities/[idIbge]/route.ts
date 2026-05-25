import { NextResponse } from "next/server";
import { getDefaultCrimeMapFilters, getDemoDataStatus } from "@/services/crimeDataService";
import { getMunicipalityById } from "@/services/municipalityService";

export async function GET(
  request: Request,
  context: { params: Promise<{ idIbge: string }> },
) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("periodo") ?? getDefaultCrimeMapFilters().period;
  const { idIbge } = await context.params;
  const item = getMunicipalityById(idIbge, period);

  if (!item) {
    return NextResponse.json({ error: "Municipio nao encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    demo: true,
    status: getDemoDataStatus(),
    item,
  });
}
