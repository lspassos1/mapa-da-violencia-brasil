// GET /api/electoral-anomaly — Radar de anomalia, LENTE ELEITORAL (#85).
// Sobre DADO OFICIAL (não OSINT): queda atípica do homicídio na janela pré-eleição
// por UF. INDÍCIO para investigar, não prova de manipulação.
import { NextResponse } from "next/server";
import { getElectoralAnomalies, ELECTION_YEARS, INDICADOR } from "@/server/anomaly/electoralCycle";

export const dynamic = "force-static"; // deriva de asset bundleado; sem I/O em runtime

export function GET() {
  const ufs = getElectoralAnomalies();
  return NextResponse.json({
    lente: "ciclo-eleitoral",
    indicador: INDICADOR,
    oficial: true,
    disclaimer:
      "INDÍCIO para investigar, não prova de manipulação. Efeito negativo = o homicídio reportado cai na janela pré-eleitoral (ago–out) em anos de eleição mais do que em anos normais — pode ter várias causas legítimas.",
    metodologia:
      "Índice sazonal intra-UF (média ago–out ÷ média do ano), comparando anos de eleição (2016–2024) com anos normais (2015–2025). Cada UF é comparada CONSIGO MESMA — evita a heterogeneidade de definição entre estados; não é ranking cru.",
    confundidores: [
      "Operação/reforço policial real no período eleitoral",
      "Mudança de notificação ou registro",
      "Subnotificação / reclassificação para 'morte a esclarecer'",
      "Coincidência — amostra pequena (5 eleições)",
    ],
    anosEleicao: ELECTION_YEARS,
    ufs,
  });
}
