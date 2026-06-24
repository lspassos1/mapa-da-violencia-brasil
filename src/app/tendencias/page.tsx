import { Suspense } from "react";
import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { TrendsDashboard } from "@/components/trends/TrendsDashboard";

export const metadata: Metadata = {
  title: "Tendências",
  description:
    "Sazonalidade e tendência da violência no Brasil e por estado: séries mensais 2015-2026, variação ano a ano (like-for-like) e totais anuais, com dados da Base VDE (SINESP/MJSP).",
};

// useSearchParams (deep-link dos filtros) exige uma fronteira de Suspense. O
// header fica FORA da fronteira para a navegacao nao desaparecer na carga.
export default function TendenciasPage() {
  return (
    <main className="flex min-h-screen flex-col text-slate-100">
      <AppHeader />
      <Suspense fallback={null}>
        <TrendsDashboard />
      </Suspense>
    </main>
  );
}
