import { Suspense } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { CrimeDashboard } from "@/components/CrimeDashboard";

// useSearchParams (deep-link dos filtros do dashboard) exige uma fronteira de
// Suspense no App Router. O fallback inclui o AppHeader para que a navegacao
// exista no HTML server-rendered (SEO e sem flash de pagina vazia).
export default function Home() {
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
