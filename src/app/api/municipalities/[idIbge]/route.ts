import { NextResponse } from "next/server";
import { demoDataStatus, mockCrimeData } from "@/data/mockCrimeData";

export async function GET(
  request: Request,
  context: { params: Promise<{ idIbge: string }> },
) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("periodo") ?? "2026-04";
  const { idIbge } = await context.params;
  const item = mockCrimeData.find((municipality) => municipality.idIbge === idIbge && municipality.periodo === period);

  if (!item) {
    return NextResponse.json({ error: "Municipio nao encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    demo: true,
    status: demoDataStatus,
    item,
  });
}

