import { NextResponse } from "next/server";
import {
  getDefaultNewsIncidentFilters,
  getNewsIncidentData,
  isNewsIncidentReviewStatusFilter,
  isNewsIncidentTypeFilter,
} from "@/services/newsIncidentService";

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const defaults = getDefaultNewsIncidentFilters();
  const period = searchParams.get("periodo") ?? searchParams.get("period") ?? defaults.period;
  const typeParam = searchParams.get("tipo") ?? searchParams.get("type") ?? defaults.type;
  const statusParam = searchParams.get("status") ?? defaults.status;
  const minConfidenceParam =
    searchParams.get("confiancaMinima") ?? searchParams.get("minConfidence") ?? String(defaults.minConfidence);
  const minConfidence = Number(minConfidenceParam);
  const uf = searchParams.get("uf");

  if (
    !isNewsIncidentTypeFilter(typeParam) ||
    !isNewsIncidentReviewStatusFilter(statusParam) ||
    !Number.isFinite(minConfidence) ||
    minConfidence < 0 ||
    minConfidence > 1
  ) {
    return NextResponse.json({ error: "Parametros invalidos" }, { status: 400 });
  }

  const result = getNewsIncidentData({
    period,
    type: typeParam,
    minConfidence,
    status: statusParam,
    uf,
  });

  return NextResponse.json({
    ...result,
    periodo: result.filters.period,
    tipo: result.filters.type,
    confiancaMinima: result.filters.minConfidence,
  });
}
