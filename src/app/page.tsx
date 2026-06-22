import type { Metadata } from "next";
import { TiroteiosDashboard } from "@/components/radar/TiroteiosDashboard";

export const metadata: Metadata = {
  title: "Radar de tiroteios em tempo quase real",
  description:
    "Tiroteios e disparos por arma de fogo georreferenciados (Fogo Cruzado), em tempo quase real. Indício, não alerta de emergência.",
  alternates: { canonical: "/" },
};

// Home do produto = radar de tiroteios (herói). O mapa oficial agregado fica em /mapa.
export default function Home() {
  return <TiroteiosDashboard />;
}
