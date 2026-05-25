import { ChevronLeft, Home } from "lucide-react";
import { getStateByUf } from "@/services/geoService";
import type { MunicipalityCrimeData } from "@/types/crime";

interface BreadcrumbProps {
  selectedMunicipality: MunicipalityCrimeData | null;
  selectedState: string | null;
  onBackToBrazil: () => void;
  onBackToState: () => void;
}

export function Breadcrumb({
  selectedMunicipality,
  selectedState,
  onBackToBrazil,
  onBackToState,
}: BreadcrumbProps) {
  const state = getStateByUf(selectedState);

  return (
    <nav className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-slate-950/75 px-3 py-2 text-sm backdrop-blur">
      <button className="flex items-center gap-1 text-cyan-200 hover:text-cyan-100" onClick={onBackToBrazil}>
        <Home className="h-4 w-4" />
        Brasil
      </button>
      {state ? (
        <>
          <span className="text-slate-500">/</span>
          <button className="text-slate-100 hover:text-cyan-200" onClick={onBackToState}>
            {state.nome}
          </button>
        </>
      ) : null}
      {selectedMunicipality ? (
        <>
          <span className="text-slate-500">/</span>
          <span className="font-semibold text-white">{selectedMunicipality.municipio}</span>
        </>
      ) : null}
      {state || selectedMunicipality ? (
        <button
          className="ml-1 flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300 hover:text-white"
          onClick={selectedMunicipality ? onBackToState : onBackToBrazil}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Voltar
        </button>
      ) : null}
    </nav>
  );
}
