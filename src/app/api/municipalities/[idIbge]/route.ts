import { NextResponse } from "next/server";
import { getServerCrimeDataApi } from "@/services/crimeDataService.server";

export async function GET(
  request: Request,
  context: { params: Promise<{ idIbge: string }> },
) {
  const api = await getServerCrimeDataApi();
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("periodo") ?? searchParams.get("period") ?? api.getDefaultCrimeMapFilters().period;
  const { idIbge } = await context.params;
  const item = api.getMunicipalityById(idIbge, period);

  if (!item) {
    return NextResponse.json({ error: "Municipio nao encontrado" }, { status: 404 });
  }

  const status = api.getDemoDataStatus();
  const metadata = api.getCrimeMetadata();

  return NextResponse.json({
    demo: metadata.dataMode === "demo",
    status,
    item,
  });
}
