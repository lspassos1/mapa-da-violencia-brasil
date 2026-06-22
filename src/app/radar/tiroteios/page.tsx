import { permanentRedirect } from "next/navigation";

// O radar de tiroteios virou a HOME (/). Caminho antigo redireciona em PERMANENTE
// (308) para preservar link equity e não quebrar links existentes.
export default function RadarTiroteiosLegacy() {
  permanentRedirect("/");
}
