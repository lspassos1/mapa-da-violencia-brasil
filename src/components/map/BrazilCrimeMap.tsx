"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { AlertCircle, Loader2 } from "lucide-react";
import { getScoreColor, getScoreRadius } from "@/lib/colorScale";
import { getMetricValueFromMetric } from "@/lib/crimeMetrics";
import { formatMetricValue } from "@/lib/formatters";
import { getNewsConfidenceColor, getNewsPointRadius } from "@/lib/newsIncidents";
import { getBoundsForState, getMunicipalityBounds } from "@/lib/mapNavigation";
import {
  createCityFeatureCollection,
  createNewsIncidentFeatureCollection,
  createStateFeatureCollection,
} from "@/services/geoService";
import type { CrimeIndicatorKey, MunicipalityCrimeData, ViewMode } from "@/types/crime";
import type { NewsIncident } from "@/types/news";
import { MapTooltip } from "./MapTooltip";
import { NewsMapTooltip } from "./NewsMapTooltip";

interface BrazilCrimeMapProps {
  data: MunicipalityCrimeData[];
  indicator: CrimeIndicatorKey;
  newsIncidents?: NewsIncident[];
  selectedMunicipality: MunicipalityCrimeData | null;
  selectedNewsIncident?: NewsIncident | null;
  selectedState: string | null;
  viewMode: ViewMode;
  onMunicipalitySelect: (item: MunicipalityCrimeData) => void;
  onNewsIncidentSelect?: (item: NewsIncident) => void;
  onStateSelect: (uf: string) => void;
}

const BRAZIL_VIEWPORT = {
  west: -74.1,
  south: -34.2,
  east: -34.7,
  north: 5.4,
};

export function BrazilCrimeMap({
  data,
  indicator,
  newsIncidents = [],
  selectedMunicipality,
  selectedNewsIncident = null,
  selectedState,
  viewMode,
  onMunicipalitySelect,
  onNewsIncidentSelect,
  onStateSelect,
}: BrazilCrimeMapProps) {
  const cityCollection = useMemo(() => createCityFeatureCollection(data, indicator, viewMode), [data, indicator, viewMode]);
  const selectedCityCollection = useMemo(
    () => createCityFeatureCollection(selectedMunicipality ? [selectedMunicipality] : [], indicator, viewMode),
    [indicator, selectedMunicipality, viewMode],
  );
  const newsCollection = useMemo(() => createNewsIncidentFeatureCollection(newsIncidents), [newsIncidents]);
  const selectedNewsCollection = useMemo(
    () => createNewsIncidentFeatureCollection(selectedNewsIncident ? [selectedNewsIncident] : []),
    [selectedNewsIncident],
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const dataRef = useRef(data);
  const newsIncidentsRef = useRef(newsIncidents);
  const onMunicipalitySelectRef = useRef(onMunicipalitySelect);
  const onNewsIncidentSelectRef = useRef(onNewsIncidentSelect);
  const onStateSelectRef = useRef(onStateSelect);
  const cityCollectionRef = useRef(cityCollection);
  const selectedCityCollectionRef = useRef(selectedCityCollection);
  const newsCollectionRef = useRef(newsCollection);
  const selectedNewsCollectionRef = useRef(selectedNewsCollection);
  const [isLoading, setIsLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [useStaticFallback, setUseStaticFallback] = useState(false);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; item: MunicipalityCrimeData } | null>(null);
  const [newsTooltip, setNewsTooltip] = useState<{ x: number; y: number; item: NewsIncident } | null>(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    newsIncidentsRef.current = newsIncidents;
  }, [newsIncidents]);

  useEffect(() => {
    cityCollectionRef.current = cityCollection;
  }, [cityCollection]);

  useEffect(() => {
    selectedCityCollectionRef.current = selectedCityCollection;
  }, [selectedCityCollection]);

  useEffect(() => {
    newsCollectionRef.current = newsCollection;
  }, [newsCollection]);

  useEffect(() => {
    selectedNewsCollectionRef.current = selectedNewsCollection;
  }, [selectedNewsCollection]);

  useEffect(() => {
    onMunicipalitySelectRef.current = onMunicipalitySelect;
  }, [onMunicipalitySelect]);

  useEffect(() => {
    onNewsIncidentSelectRef.current = onNewsIncidentSelect;
  }, [onNewsIncidentSelect]);

  useEffect(() => {
    onStateSelectRef.current = onStateSelect;
  }, [onStateSelect]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    let isDisposed = false;

    async function initializeMap() {
      if (!hasWebGlSupport()) {
        setMapError("Mapa interativo indisponivel neste navegador.");
        setUseStaticFallback(true);
        setIsLoading(false);
        return;
      }

      try {
        const maplibregl = (await import("maplibre-gl")).default;
        if (isDisposed || !containerRef.current) {
          return;
        }

        const map = new maplibregl.Map({
          container: containerRef.current,
          center: [-52, -14],
          zoom: 3.35,
          minZoom: 2.8,
          maxZoom: 10,
          attributionControl: false,
          style: {
            version: 8,
            sources: {
              base: {
                type: "raster",
                tiles: ["https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"],
                tileSize: 256,
                attribution: "OpenStreetMap, CARTO",
              },
            },
            layers: [
              {
                id: "base",
                type: "raster",
                source: "base",
                paint: {
                  "raster-opacity": 0.68,
                },
              },
            ],
          },
        });

        map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "bottom-right");
        map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
        mapRef.current = map;

        map.on("load", () => {
          if (isDisposed) {
            return;
          }
          map.addSource("states", {
            type: "geojson",
            data: createStateFeatureCollection(),
          });
          map.addSource("cities", {
            type: "geojson",
            data: cityCollectionRef.current,
            promoteId: "idIbge",
          });
          map.addSource("selected-city", {
            type: "geojson",
            data: selectedCityCollectionRef.current,
          });
          map.addSource("news-incidents", {
            type: "geojson",
            data: newsCollectionRef.current,
            promoteId: "id",
          });
          map.addSource("selected-news-incident", {
            type: "geojson",
            data: selectedNewsCollectionRef.current,
          });

          map.addLayer({
            id: "states-fill",
            type: "fill",
            source: "states",
            paint: {
              "fill-color": "#38bdf8",
              "fill-opacity": ["case", ["==", ["get", "uf"], ""], 0.16, 0.04],
            },
          });
          map.addLayer({
            id: "states-line",
            type: "line",
            source: "states",
            paint: {
              "line-color": "#67e8f9",
              "line-opacity": 0.34,
              "line-width": 1.2,
            },
          });
          map.addLayer({
            id: "selected-state-line",
            type: "line",
            source: "states",
            filter: ["==", ["get", "uf"], ""],
            paint: {
              "line-color": "#f8fafc",
              "line-opacity": 0.9,
              "line-width": 2.4,
            },
          });
          map.addLayer({
            id: "city-points",
            type: "circle",
            source: "cities",
            paint: {
              "circle-color": ["get", "color"],
              "circle-radius": ["get", "radius"],
              "circle-stroke-width": 1.8,
              "circle-stroke-color": "#f8fafc",
              "circle-opacity": 0.92,
            },
          });
          map.addLayer({
            id: "selected-city",
            type: "circle",
            source: "selected-city",
            paint: {
              "circle-color": ["get", "color"],
              "circle-radius": 24,
              "circle-stroke-width": 4,
              "circle-stroke-color": "#f8fafc",
              "circle-opacity": 0.45,
            },
          });
          map.addLayer({
            id: "news-incidents-halo",
            type: "circle",
            source: "news-incidents",
            paint: {
              "circle-color": "#fbbf24",
              "circle-radius": ["+", ["get", "radius"], 7],
              "circle-opacity": 0.18,
            },
          });
          map.addLayer({
            id: "news-incidents",
            type: "circle",
            source: "news-incidents",
            paint: {
              "circle-color": ["get", "color"],
              "circle-radius": ["get", "radius"],
              "circle-stroke-width": 2.2,
              "circle-stroke-color": "#111827",
              "circle-opacity": 0.96,
            },
          });
          map.addLayer({
            id: "selected-news-incident",
            type: "circle",
            source: "selected-news-incident",
            paint: {
              "circle-color": "#f59e0b",
              "circle-radius": 22,
              "circle-stroke-width": 4,
              "circle-stroke-color": "#f8fafc",
              "circle-opacity": 0.42,
            },
          });

          map.on("click", "states-fill", (event) => {
            const feature = event.features?.[0];
            const uf = feature?.properties?.uf;
            if (typeof uf === "string") {
              onStateSelectRef.current(uf);
            }
          });
          map.on("click", "city-points", (event) => {
            const feature = event.features?.[0];
            const idIbge = feature?.properties?.idIbge;
            const item = dataRef.current.find((municipality) => municipality.idIbge === idIbge);
            if (item) {
              onMunicipalitySelectRef.current(item);
            }
          });
          map.on("click", "news-incidents", (event) => {
            const feature = event.features?.[0];
            const id = feature?.properties?.id;
            const item = newsIncidentsRef.current.find((incident) => incident.id === id);
            if (item) {
              onNewsIncidentSelectRef.current?.(item);
            }
          });
          map.on("mousemove", "city-points", (event) => {
            map.getCanvas().style.cursor = "pointer";
            const feature = event.features?.[0];
            const idIbge = feature?.properties?.idIbge;
            const item = dataRef.current.find((municipality) => municipality.idIbge === idIbge);
            if (item) {
              setNewsTooltip(null);
              setTooltip({ x: event.point.x, y: event.point.y, item });
            }
          });
          map.on("mouseleave", "city-points", () => {
            map.getCanvas().style.cursor = "";
            setTooltip(null);
          });
          map.on("mousemove", "news-incidents", (event) => {
            map.getCanvas().style.cursor = "pointer";
            const feature = event.features?.[0];
            const id = feature?.properties?.id;
            const item = newsIncidentsRef.current.find((incident) => incident.id === id);
            if (item) {
              setTooltip(null);
              setNewsTooltip({ x: event.point.x, y: event.point.y, item });
            }
          });
          map.on("mouseleave", "news-incidents", () => {
            map.getCanvas().style.cursor = "";
            setNewsTooltip(null);
          });
          map.on("mousemove", "states-fill", () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", "states-fill", () => {
            map.getCanvas().style.cursor = "";
          });

          map.fitBounds(
            [
              [BRAZIL_VIEWPORT.west, BRAZIL_VIEWPORT.south],
              [BRAZIL_VIEWPORT.east, BRAZIL_VIEWPORT.north],
            ],
            { padding: 42, duration: 0 },
          );
          setIsLoading(false);
        });

        map.on("error", () => {
          setMapError("Nao foi possivel carregar todos os recursos do mapa.");
        });
      } catch {
        if (!isDisposed) {
          setMapError("Nao foi possivel inicializar o mapa.");
          setUseStaticFallback(true);
          setIsLoading(false);
        }
      }
    }

    void initializeMap();

    return () => {
      isDisposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) {
      return;
    }
    const cities = map.getSource("cities") as GeoJSONSource | undefined;
    cities?.setData(cityCollection);
  }, [cityCollection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) {
      return;
    }
    const selectedCity = map.getSource("selected-city") as GeoJSONSource | undefined;
    selectedCity?.setData(selectedCityCollection);
  }, [selectedCityCollection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) {
      return;
    }
    const news = map.getSource("news-incidents") as GeoJSONSource | undefined;
    news?.setData(newsCollection);
  }, [newsCollection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) {
      return;
    }
    const selectedNews = map.getSource("selected-news-incident") as GeoJSONSource | undefined;
    selectedNews?.setData(selectedNewsCollection);
  }, [selectedNewsCollection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) {
      return;
    }
    map.setFilter("selected-state-line", ["==", ["get", "uf"], selectedState ?? ""]);
    map.setPaintProperty("states-fill", "fill-opacity", [
      "case",
      ["==", ["get", "uf"], selectedState ?? ""],
      0.16,
      0.04,
    ]);

    if (selectedMunicipality) {
      const [west, south, east, north] = getMunicipalityBounds(selectedMunicipality.lng, selectedMunicipality.lat);
      map.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        { padding: 120, duration: 900 },
      );
      return;
    }

    if (selectedNewsIncident) {
      const [west, south, east, north] = getMunicipalityBounds(selectedNewsIncident.lng, selectedNewsIncident.lat);
      map.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        { padding: 120, duration: 900 },
      );
      return;
    }

    const [west, south, east, north] = getBoundsForState(selectedState);
    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: selectedState ? 96 : 42, duration: 900 },
    );
  }, [selectedMunicipality, selectedNewsIncident, selectedState]);

  return (
    <div className="relative h-full min-h-[620px]">
      <div ref={containerRef} className="absolute inset-0 z-0" />
      {useStaticFallback ? (
        <StaticCrimeMapFallback
          data={data}
          indicator={indicator}
          newsIncidents={newsIncidents}
          selectedMunicipality={selectedMunicipality}
          selectedNewsIncident={selectedNewsIncident}
          selectedState={selectedState}
          viewMode={viewMode}
          onMunicipalitySelect={onMunicipalitySelect}
          onNewsIncidentSelect={onNewsIncidentSelect}
          onStateSelect={onStateSelect}
        />
      ) : null}
      {isLoading ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/70">
          <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200">
            <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
            Carregando mapa
          </div>
        </div>
      ) : null}
      {mapError && !useStaticFallback ? (
        <div className="absolute right-4 top-20 z-20 flex max-w-sm items-start gap-3 rounded-lg border border-red-300/20 bg-red-950/80 p-3 text-sm text-red-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {mapError}
        </div>
      ) : null}
      {!isLoading && data.length === 0 && newsIncidents.length === 0 ? (
        <div className="absolute inset-0 z-[2] flex items-center justify-center bg-slate-950/50">
          <p className="rounded-lg border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-300">
            Nenhum dado demonstrativo encontrado para este periodo.
          </p>
        </div>
      ) : null}
      <MapTooltip indicator={indicator} tooltip={tooltip} />
      <NewsMapTooltip tooltip={newsTooltip} />
    </div>
  );
}

function StaticCrimeMapFallback({
  data,
  indicator,
  newsIncidents = [],
  selectedMunicipality,
  selectedNewsIncident = null,
  selectedState,
  viewMode,
  onMunicipalitySelect,
  onNewsIncidentSelect,
  onStateSelect,
}: BrazilCrimeMapProps) {
  const states = useMemo(() => Array.from(new Set(data.map((item) => item.uf))).sort(), [data]);
  const visibleStates = useMemo(
    () => Array.from(new Set([...data.map((item) => item.uf), ...newsIncidents.map((item) => item.uf)])).sort(),
    [data, newsIncidents],
  );

  return (
    <div className="absolute inset-0 z-[1] overflow-hidden bg-[radial-gradient(circle_at_50%_45%,rgba(14,165,233,0.18),rgba(15,23,42,0.96)_58%)]">
      <div className="absolute inset-x-10 bottom-16 top-24 rounded-[42%] border border-cyan-300/15 bg-cyan-300/[0.03]" />
      <div className="absolute right-4 top-20 max-w-[260px] rounded-lg border border-white/10 bg-slate-950/85 p-3 text-xs leading-5 text-slate-300 shadow-xl backdrop-blur">
        <p className="font-semibold text-slate-100">Mapa estatico</p>
        <p className="mt-1">WebGL indisponivel; exibindo posicoes aproximadas dos municipios.</p>
      </div>
      <div className="absolute bottom-8 right-4 flex max-w-[300px] flex-wrap justify-end gap-2">
        {(visibleStates.length > 0 ? visibleStates : states).map((uf) => (
          <button
            key={uf}
            className={`h-8 rounded-md border px-2 text-xs font-semibold transition ${
              selectedState === uf
                ? "border-cyan-200 bg-cyan-300/20 text-cyan-100"
                : "border-white/10 bg-slate-950/80 text-slate-300 hover:border-cyan-300/40"
            }`}
            type="button"
            onClick={() => onStateSelect(uf)}
          >
            {uf}
          </button>
        ))}
      </div>
      {data.map((item) => {
        const metric = item.indicadores[indicator];
        if (!metric) {
          return null;
        }

        const metricValue = getMetricValueFromMetric(metric, viewMode);
        const size = Math.round(getScoreRadius(metric.score) * 1.45);
        const isSelected = selectedMunicipality?.idIbge === item.idIbge;
        const style = {
          backgroundColor: getScoreColor(metric.score),
          height: `${size}px`,
          left: `${longitudeToPercent(item.lng)}%`,
          top: `${latitudeToPercent(item.lat)}%`,
          width: `${size}px`,
        };

        return (
          <button
            key={item.idIbge}
            aria-label={`${item.municipio}, ${item.uf}: ${formatMetricValue(metricValue, viewMode)}`}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-lg transition hover:scale-110 ${
              isSelected ? "border-white ring-4 ring-cyan-200/40" : "border-slate-100/90"
            }`}
            style={style}
            title={`${item.municipio} / ${item.uf}`}
            type="button"
            onClick={() => onMunicipalitySelect(item)}
          >
            <span className="sr-only">
              {item.municipio} / {item.uf}
            </span>
          </button>
        );
      })}
      {newsIncidents.map((item) => {
        const size = Math.round(getNewsPointRadius(item.confidence) * 1.35);
        const isSelected = selectedNewsIncident?.id === item.id;
        const style = {
          backgroundColor: getNewsConfidenceColor(item.confidence),
          height: `${size}px`,
          left: `${longitudeToPercent(item.lng)}%`,
          top: `${latitudeToPercent(item.lat)}%`,
          width: `${size}px`,
        };

        return (
          <button
            key={item.id}
            aria-label={`${item.municipality}, ${item.uf}: noticia com ${Math.round(item.confidence * 100)}% de confianca`}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-md border-2 shadow-lg transition hover:scale-110 ${
              isSelected ? "border-white ring-4 ring-amber-200/40" : "border-slate-950"
            }`}
            style={style}
            title={`${item.municipality} / ${item.uf}`}
            type="button"
            onClick={() => onNewsIncidentSelect?.(item)}
          >
            <span className="sr-only">
              {item.municipality} / {item.uf}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function hasWebGlSupport(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

function longitudeToPercent(lng: number): number {
  const ratio = (lng - BRAZIL_VIEWPORT.west) / (BRAZIL_VIEWPORT.east - BRAZIL_VIEWPORT.west);
  return clamp(ratio * 100, 8, 92);
}

function latitudeToPercent(lat: number): number {
  const ratio = (BRAZIL_VIEWPORT.north - lat) / (BRAZIL_VIEWPORT.north - BRAZIL_VIEWPORT.south);
  return clamp(ratio * 100, 12, 88);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
