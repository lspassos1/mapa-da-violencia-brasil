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
    <nav className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-panel/75 px-3 py-2 text-sm backdrop-blur">
      <button className="flex items-center gap-1 text-sec hover:text-ink" onClick={onBackToBrazil}>
        <Home className="h-4 w-4" />
        Brasil
      </button>
      {state ? (
        <>
          <span className="text-quat">/</span>
          <button className="text-ink hover:text-ink" onClick={onBackToState}>
            {state.nome}
          </button>
        </>
      ) : null}
      {selectedMunicipality ? (
        <>
          <span className="text-quat">/</span>
          <span className="font-semibold text-ink">{selectedMunicipality.municipio}</span>
        </>
      ) : null}
      {state || selectedMunicipality ? (
        <button
          className="ml-1 flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs text-sec hover:text-ink"
          onClick={selectedMunicipality ? onBackToState : onBackToBrazil}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Voltar
        </button>
      ) : null}
    </nav>
  );
}
