import type { Metadata } from "next";
import { Suspense } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { CrimeDashboard } from "@/components/CrimeDashboard";

export const metadata: Metadata = {
  title: "Mapa oficial — homicídio doloso por município",
  description:
    "Indicadores oficiais agregados (SINESP/MJSP) por município, com filtros, comparação e tendências.",
  alternates: { canonical: "/mapa" },
};

// Mapa oficial agregado (antes era a home; agora vive em /mapa — a home é o radar).
// useSearchParams (deep-link dos filtros) exige fronteira de Suspense no App Router.
export default function MapaOficialPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen flex-col text-slate-100">
          <AppHeader />
        </main>
      }
    >
      <CrimeDashboard />
    </Suspense>
  );
}
