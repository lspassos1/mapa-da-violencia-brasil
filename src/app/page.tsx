import { Suspense } from "react";
import { CrimeDashboard } from "@/components/CrimeDashboard";

// useSearchParams (deep-link dos filtros do dashboard) exige uma fronteira de
// Suspense no App Router.
export default function Home() {
  return (
    <Suspense fallback={null}>
      <CrimeDashboard />
    </Suspense>
  );
}
