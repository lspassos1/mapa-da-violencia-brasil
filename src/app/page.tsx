import type { Metadata } from "next";
import monthly from "@/data/monthlySeries.json";
import { TiroteiosDashboard, type SerieNacional } from "@/components/radar/TiroteiosDashboard";

export const metadata: Metadata = {
  title: "Radar de tiroteios em tempo quase real",
  description:
    "Tiroteios e disparos por arma de fogo georreferenciados (Fogo Cruzado), em tempo quase real. Indício, não alerta de emergência.",
  alternates: { canonical: "/" },
};

// Série nacional (SINESP/VDE) resolvida NO SERVIDOR a partir do asset já
// versionado — só os ~136 pontos do BR viajam ao cliente, não o JSON inteiro.
function serieNacional(): SerieNacional {
  const br = (monthly as { series: Record<string, Record<string, number>> }).series.BR ?? {};
  const labels = Object.keys(br).sort();
  return { labels, vals: labels.map((k) => br[k]) };
}

// Home do produto = radar de tiroteios (herói). O mapa oficial agregado fica em /mapa.
export default function Home() {
  return <TiroteiosDashboard nacional={serieNacional()} />;
}
