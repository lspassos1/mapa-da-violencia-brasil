export type Bounds = [number, number, number, number];

export interface StateMapInfo {
  uf: string;
  nome: string;
  bounds: Bounds;
  centroid: [number, number];
}

export type NavigationLevel = "brasil" | "estado" | "municipio";

