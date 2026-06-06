import type { FeatureCollection, MultiPolygon, Point, Polygon } from "geojson";

export type Bounds = [number, number, number, number];

export interface StateMapInfo {
  uf: string;
  nome: string;
  bounds: Bounds;
  centroid: [number, number];
}

export type GeoFeatureProperties = Record<string, string | number | boolean | null>;

export type GeoFeatureCollection = FeatureCollection<Point | Polygon | MultiPolygon, GeoFeatureProperties>;
