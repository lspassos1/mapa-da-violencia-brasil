import { redirect } from "next/navigation";

// O radar de tiroteios virou a HOME (/). Mantém este caminho antigo redirecionando
// para não quebrar links existentes.
export default function RadarTiroteiosLegacy() {
  redirect("/");
}
