import Link from "next/link";
import { AlertTriangle, Info } from "lucide-react";
import type { CrimeMetadata } from "@/types/crime";

interface DataModeBannerProps {
  mode: CrimeMetadata["dataMode"];
  municipalities: number;
  periodLabel: string;
}

// Banner proeminente sobre a vintage/escopo dos dados. Em modo demonstrativo
// avisa que os valores nao sao reais; em amostra oficial deixa claro que e
// parcial e que a taxa por 100 mil esta indisponivel.
export function DataModeBanner({ mode, municipalities, periodLabel }: DataModeBannerProps) {
  if (mode === "official") {
    return null;
  }

  if (mode === "official_sample") {
    return (
      <div
        role="note"
        className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line bg-[rgba(236,234,228,.05)] px-5 py-2.5 text-sm text-ink"
      >
        <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          <strong>Amostra oficial parcial</strong> — {municipalities} municipios, periodo {periodLabel}.
          Apenas homicidio doloso; taxa por 100 mil indisponivel (populacao de ano diferente).
        </span>
        <Link className="font-semibold underline-offset-4 hover:underline" href="/metodologia">
          Metodologia
        </Link>
      </div>
    );
  }

  return (
    <div
      role="note"
      className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-edge bg-[rgba(86,91,99,.15)] px-5 py-2.5 text-sm text-sec"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        <strong>Dados demonstrativos</strong> nesta versao — nao representam valores reais de
        criminalidade ({municipalities} municipios, periodo {periodLabel}).
      </span>
      <Link className="font-semibold underline-offset-4 hover:underline" href="/metodologia">
        Saiba mais
      </Link>
    </div>
  );
}
