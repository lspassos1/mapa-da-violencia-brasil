import type { StateMapInfo } from "@/types/map";

export const brazilBounds = [-74.1, -34.2, -34.7, 5.4] as const;

export const stateMapData: StateMapInfo[] = [
  { uf: "AM", nome: "Amazonas", bounds: [-73.8, -9.8, -56.0, 2.4], centroid: [-63.3, -4.1] },
  { uf: "PA", nome: "Para", bounds: [-58.9, -9.9, -46.1, 2.7], centroid: [-52.5, -4.4] },
  { uf: "CE", nome: "Ceara", bounds: [-41.4, -7.9, -37.2, -2.7], centroid: [-39.6, -5.1] },
  { uf: "PE", nome: "Pernambuco", bounds: [-41.4, -9.5, -34.8, -7.2], centroid: [-38.5, -8.4] },
  { uf: "BA", nome: "Bahia", bounds: [-46.6, -18.4, -37.3, -8.5], centroid: [-41.8, -13.2] },
  { uf: "DF", nome: "Distrito Federal", bounds: [-48.3, -16.1, -47.3, -15.5], centroid: [-47.9, -15.8] },
  { uf: "GO", nome: "Goias", bounds: [-53.3, -19.5, -45.9, -12.4], centroid: [-49.6, -16.1] },
  { uf: "MG", nome: "Minas Gerais", bounds: [-51.1, -22.9, -39.8, -14.1], centroid: [-44.6, -18.6] },
  { uf: "SP", nome: "Sao Paulo", bounds: [-53.2, -25.4, -44.2, -19.8], centroid: [-48.7, -22.6] },
  { uf: "RJ", nome: "Rio de Janeiro", bounds: [-44.9, -23.4, -40.9, -20.7], centroid: [-43.2, -22.2] },
  { uf: "PR", nome: "Parana", bounds: [-54.6, -26.8, -48.0, -22.5], centroid: [-51.3, -24.7] },
  { uf: "RS", nome: "Rio Grande do Sul", bounds: [-57.7, -33.8, -49.7, -27.1], centroid: [-53.6, -30.2] },
];

export function getStateByUf(uf: string | null): StateMapInfo | undefined {
  if (!uf) {
    return undefined;
  }
  return stateMapData.find((state) => state.uf === uf);
}

export function createStateFeatureCollection() {
  return {
    type: "FeatureCollection" as const,
    features: stateMapData.map((state) => {
      const [west, south, east, north] = state.bounds;
      return {
        type: "Feature" as const,
        properties: {
          uf: state.uf,
          nome: state.nome,
        },
        geometry: {
          type: "Polygon" as const,
          coordinates: [
            [
              [west, south],
              [east, south],
              [east, north],
              [west, north],
              [west, south],
            ],
          ],
        },
      };
    }),
  };
}

