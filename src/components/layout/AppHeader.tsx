import Link from "next/link";
import { MapPinned } from "lucide-react";

export function AppHeader() {
  return (
    <header className="flex items-center justify-between border-b border-white/10 bg-slate-950/90 px-5 py-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-200">
          <MapPinned className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-wide">Mapa da Violencia Brasil</h1>
          <p className="text-xs text-slate-400">Inteligencia geografica demonstrativa</p>
        </div>
      </div>
      <Link
        className="rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-slate-200 hover:border-cyan-300/50 hover:text-cyan-200"
        href="/metodologia"
      >
        Metodologia
      </Link>
    </header>
  );
}

