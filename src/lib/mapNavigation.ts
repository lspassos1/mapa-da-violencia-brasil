import type { Bounds } from "@/types/geo";
import { getBrazilBounds, getStateByUf } from "@/services/geoService";

export function getBoundsForState(uf: string | null): Bounds {
  return getStateByUf(uf)?.bounds ?? getBrazilBounds();
}

export function getMunicipalityBounds(lng: number, lat: number): Bounds {
  return [lng - 0.55, lat - 0.45, lng + 0.55, lat + 0.45];
}
