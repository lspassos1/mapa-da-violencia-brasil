import type { Bounds } from "@/types/map";
import { brazilBounds, getStateByUf } from "@/data/stateGeometries";

export function getBoundsForState(uf: string | null): Bounds {
  return getStateByUf(uf)?.bounds ?? [...brazilBounds];
}

export function getMunicipalityBounds(lng: number, lat: number): Bounds {
  return [lng - 0.55, lat - 0.45, lng + 0.55, lat + 0.45];
}

