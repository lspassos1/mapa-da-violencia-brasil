const REPOSITORY_URL = "https://github.com/lspassos1/mapa-da-violencia-brasil";

// Footer do instrumento — mono, hairline, semântica de cor preservada.
export function AppFooter() {
  return (
    <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-hair bg-bg0 px-7 py-4 font-mono text-[9.5px] tracking-[.1em] text-quat">
      <span className="tracking-[.18em] text-sec">MAPA DA VIOLÊNCIA BRASIL</span>
      <a
        className="hover:text-ink"
        href={REPOSITORY_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Ver o código-fonte no GitHub (licença AGPL-3.0)"
      >
        AGPL-3.0 · CÓDIGO ABERTO
      </a>
      <span>
        DADOS: FOGO CRUZADO · SINESP/MJSP · SIM/DATASUS · ISP-RJ · IBGE · MAPA ©{" "}
        <a className="hover:text-ink" href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">
          CARTO
        </a>
        /
        <a
          className="hover:text-ink"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
        >
          OSM
        </a>
      </span>
      <span className="ml-auto text-indiciodim">INDÍCIO ≠ ESTATÍSTICA OFICIAL</span>
      <span className="text-registro">EMERGÊNCIA: 190</span>
    </footer>
  );
}
