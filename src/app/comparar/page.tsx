import { Suspense } from "react";
import type { Metadata } from "next";
import { CompareDashboard } from "@/components/compare/CompareDashboard";

export const metadata: Metadata = {
  title: "Comparar estados — Mapa da Violencia Brasil",
  description:
    "Compare 2 a 4 estados brasileiros lado a lado: indice 0-100, total de vitimas e taxa por 100 mil, com series historicas 2015-2026 da Base VDE (SINESP/MJSP).",
};

// useSearchParams (deep-link dos filtros) exige uma fronteira de Suspense.
export default function CompararPage() {
  return (
    <Suspense fallback={null}>
      <CompareDashboard />
    </Suspense>
  );
}
