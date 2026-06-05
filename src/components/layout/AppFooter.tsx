import { Code2 } from "lucide-react";

const REPOSITORY_URL = "https://github.com/lspassos1/mapa-da-violencia-brasil";

export function AppFooter() {
  return (
    <footer className="border-t border-white/10 bg-slate-950/90 px-5 py-4 text-xs text-slate-400 backdrop-blur">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <a
            className="inline-flex items-center gap-1.5 font-medium text-slate-200 underline-offset-4 hover:text-cyan-200 hover:underline"
            href={REPOSITORY_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ver o codigo-fonte no GitHub (licenca AGPL-3.0)"
          >
            <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
            Codigo-fonte
          </a>
          <span aria-hidden="true">·</span>
          <span>
            Licenciado sob{" "}
            <a
              className="underline-offset-4 hover:text-cyan-200 hover:underline"
              href={`${REPOSITORY_URL}/blob/main/LICENSE`}
              target="_blank"
              rel="noopener noreferrer"
            >
              AGPL-3.0
            </a>
          </span>
        </p>
        <p className="text-slate-500">
          Mapa base ©{" "}
          <a
            className="underline-offset-4 hover:text-cyan-200 hover:underline"
            href="https://carto.com/attributions"
            target="_blank"
            rel="noopener noreferrer"
          >
            CARTO
          </a>
          , dados ©{" "}
          <a
            className="underline-offset-4 hover:text-cyan-200 hover:underline"
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
          >
            OpenStreetMap
          </a>
        </p>
      </div>
    </footer>
  );
}
