import type { Bounds, StateMapInfo } from "@/types/geo";

export const brazilBounds: Bounds = [-74.1, -34.2, -34.7, 5.4];

// Cobertura completa das 27 unidades federativas (26 estados + Distrito Federal).
// `bounds` segue o formato [oeste, sul, leste, norte] (minLon, minLat, maxLon, maxLat)
// e `centroid` segue [lon, lat]. Os valores sao caixas envolventes aproximadas a
// partir da malha de estados do IBGE, suficientes para enquadrar o clique/zoom por UF.
// A fronteira poligonal real (GeoJSON/TopoJSON simplificado) e trabalho separado (issue #14).
export const stateMapData: StateMapInfo[] = [
  { uf: "AC", nome: "Acre", bounds: [-73.99, -11.15, -66.62, -7.11], centroid: [-70.5, -9.0] },
  { uf: "AL", nome: "Alagoas", bounds: [-38.24, -10.5, -35.15, -8.81], centroid: [-36.62, -9.57] },
  { uf: "AP", nome: "Amapa", bounds: [-54.88, -1.24, -49.87, 4.44], centroid: [-51.96, 1.41] },
  { uf: "AM", nome: "Amazonas", bounds: [-73.8, -9.82, -56.1, 2.25], centroid: [-64.7, -4.15] },
  { uf: "BA", nome: "Bahia", bounds: [-46.62, -18.35, -37.34, -8.53], centroid: [-41.7, -12.96] },
  { uf: "CE", nome: "Ceara", bounds: [-41.42, -7.86, -37.25, -2.78], centroid: [-39.32, -5.2] },
  { uf: "DF", nome: "Distrito Federal", bounds: [-48.29, -16.05, -47.31, -15.5], centroid: [-47.8, -15.78] },
  { uf: "ES", nome: "Espirito Santo", bounds: [-41.88, -21.3, -39.66, -17.89], centroid: [-40.67, -19.58] },
  { uf: "GO", nome: "Goias", bounds: [-53.25, -19.5, -45.91, -12.39], centroid: [-49.6, -15.93] },
  { uf: "MA", nome: "Maranhao", bounds: [-48.75, -10.26, -41.8, -1.04], centroid: [-45.28, -5.42] },
  { uf: "MT", nome: "Mato Grosso", bounds: [-61.63, -18.04, -50.22, -7.35], centroid: [-55.9, -12.68] },
  { uf: "MS", nome: "Mato Grosso do Sul", bounds: [-58.17, -24.07, -50.92, -17.17], centroid: [-54.6, -20.51] },
  { uf: "MG", nome: "Minas Gerais", bounds: [-51.05, -22.92, -39.86, -14.23], centroid: [-44.6, -18.1] },
  { uf: "PA", nome: "Para", bounds: [-58.9, -9.84, -46.06, 2.59], centroid: [-52.5, -3.79] },
  { uf: "PB", nome: "Paraiba", bounds: [-38.77, -8.3, -34.79, -6.02], centroid: [-36.72, -7.24] },
  { uf: "PR", nome: "Parana", bounds: [-54.62, -26.72, -48.02, -22.52], centroid: [-51.6, -24.6] },
  { uf: "PE", nome: "Pernambuco", bounds: [-41.36, -9.48, -34.81, -7.27], centroid: [-37.9, -8.38] },
  { uf: "PI", nome: "Piaui", bounds: [-45.99, -10.93, -40.37, -2.74], centroid: [-43.0, -7.45] },
  { uf: "RJ", nome: "Rio de Janeiro", bounds: [-44.89, -23.37, -40.96, -20.76], centroid: [-42.8, -22.25] },
  { uf: "RN", nome: "Rio Grande do Norte", bounds: [-38.58, -6.98, -34.97, -4.83], centroid: [-36.6, -5.81] },
  { uf: "RS", nome: "Rio Grande do Sul", bounds: [-57.65, -33.75, -49.69, -27.08], centroid: [-53.2, -30.17] },
  { uf: "RO", nome: "Rondonia", bounds: [-66.81, -13.69, -59.77, -7.97], centroid: [-62.8, -10.83] },
  { uf: "RR", nome: "Roraima", bounds: [-64.82, -1.58, -58.89, 5.27], centroid: [-61.4, 2.05] },
  { uf: "SC", nome: "Santa Catarina", bounds: [-53.84, -29.36, -48.35, -25.95], centroid: [-50.5, -27.45] },
  { uf: "SP", nome: "Sao Paulo", bounds: [-53.11, -25.31, -44.16, -19.78], centroid: [-48.6, -22.2] },
  { uf: "SE", nome: "Sergipe", bounds: [-38.25, -11.57, -36.39, -9.51], centroid: [-37.45, -10.57] },
  { uf: "TO", nome: "Tocantins", bounds: [-50.74, -13.47, -45.69, -5.17], centroid: [-48.3, -9.96] },
];
