import type { Bounds } from "@/types/geo";
import { getBrazilBounds, getStateByUf } from "@/services/geoService";

export function getBoundsForState(uf: string | null): Bounds {
  return getStateByUf(uf)?.bounds ?? getBrazilBounds();
}

export function getMunicipalityBounds(lng: number, lat: number): Bounds {
  return [lng - 0.55, lat - 0.45, lng + 0.55, lat + 0.45];
}

// Caixa envolvente dos pontos visiveis. Permite enquadrar o mapa na extensao
// real dos dados (ex.: uma amostra regional) em vez de mostrar sempre o Brasil
// inteiro com poucos pontos perdidos num canto. Devolve null quando nao ha dados.
export function getBoundsForData(points: ReadonlyArray<{ lat: number; lng: number }>): Bounds | null {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const { lat, lng } of points) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      continue;
    }
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  if (!Number.isFinite(minLng) || !Number.isFinite(minLat)) {
    return null;
  }
  return [minLng, minLat, maxLng, maxLat];
}
