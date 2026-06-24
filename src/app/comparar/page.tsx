import { Suspense } from "react";
import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { CompareDashboard } from "@/components/compare/CompareDashboard";

export const metadata: Metadata = {
  title: "Comparar estados",
  description:
    "Compare 2 a 4 estados brasileiros lado a lado: índice 0-100, total de vítimas e taxa por 100 mil, com séries históricas 2015-2026 da Base VDE (SINESP/MJSP).",
};

// useSearchParams (deep-link dos filtros) exige uma fronteira de Suspense. O
// header fica FORA da fronteira para a navegacao nao desaparecer durante a
// suspensao inicial (sem flash de pagina em branco).
export default function CompararPage() {
  return (
    <main className="flex min-h-screen flex-col text-slate-100">
      <AppHeader />
      <Suspense fallback={null}>
        <CompareDashboard />
      </Suspense>
    </main>
  );
}
