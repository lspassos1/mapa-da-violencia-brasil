import { brazilBounds, stateMapData } from "@/data/stateGeometries";
import { getScoreColor, getScoreRadius } from "@/lib/colorScale";
import { getMetricValueFromMetric } from "@/lib/crimeMetrics";
import { getNewsConfidenceColor, getNewsPointRadius } from "@/lib/newsIncidents";
import type { CrimeIndicatorKey, MunicipalityCrimeData, ViewMode } from "@/types/crime";
import type { Bounds, GeoFeatureCollection, StateMapInfo } from "@/types/geo";
import type { NewsIncident } from "@/types/news";

export function getBrazilBounds(): Bounds {
  return [...brazilBounds];
}

export function getStates(): StateMapInfo[] {
  return stateMapData.map((state) => ({
    ...state,
    bounds: [...state.bounds],
    centroid: [...state.centroid],
  }));
}

export function getStateByUf(uf: string | null): StateMapInfo | undefined {
  if (!uf) {
    return undefined;
  }
  return stateMapData.find((state) => state.uf === uf);
}

export function createStateFeatureCollection(): GeoFeatureCollection {
  return {
    type: "FeatureCollection",
    features: stateMapData.map((state) => {
      const [west, south, east, north] = state.bounds;
      return {
        type: "Feature",
        properties: {
          uf: state.uf,
          nome: state.nome,
        },
        geometry: {
          type: "Polygon",
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

export function createCityFeatureCollection(
  data: MunicipalityCrimeData[],
  indicator: CrimeIndicatorKey,
  viewMode: ViewMode,
): GeoFeatureCollection {
  return {
    type: "FeatureCollection",
    features: data.flatMap((item) => {
      const metric = item.indicadores[indicator];
      if (!metric || metric.dataStatus === "sem_dados" || metric.dataStatus === "nao_aplicavel") {
        return [];
      }

      return {
        type: "Feature",
        properties: {
          idIbge: item.idIbge,
          municipio: item.municipio,
          uf: item.uf,
          score: metric.score,
          value: getMetricValueFromMetric(metric, viewMode),
          color: getScoreColor(metric.score),
          radius: getScoreRadius(metric.score),
        },
        geometry: {
          type: "Point",
          coordinates: [item.lng, item.lat],
        },
      };
    }),
  };
}

export function createNewsIncidentFeatureCollection(data: NewsIncident[]): GeoFeatureCollection {
  return {
    type: "FeatureCollection",
    features: data.map((incident) => ({
      type: "Feature",
      properties: {
        id: incident.id,
        municipio: incident.municipality,
        uf: incident.uf,
        type: incident.type,
        confidence: incident.confidence,
        color: getNewsConfidenceColor(incident.confidence),
        radius: getNewsPointRadius(incident.confidence),
      },
      geometry: {
        type: "Point",
        coordinates: [incident.lng, incident.lat],
      },
    })),
  };
}
