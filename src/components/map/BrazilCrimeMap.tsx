"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl";
import { AlertCircle, Loader2 } from "lucide-react";
import { getBoundsForState, getMunicipalityBounds } from "@/lib/mapNavigation";
import { createCityFeatureCollection, createStateFeatureCollection } from "@/services/geoService";
import type { CrimeIndicatorKey, MunicipalityCrimeData, ViewMode } from "@/types/crime";
import { MapTooltip } from "./MapTooltip";

interface BrazilCrimeMapProps {
  data: MunicipalityCrimeData[];
  indicator: CrimeIndicatorKey;
  selectedMunicipality: MunicipalityCrimeData | null;
  selectedState: string | null;
  viewMode: ViewMode;
  onMunicipalitySelect: (item: MunicipalityCrimeData) => void;
  onStateSelect: (uf: string) => void;
}

export function BrazilCrimeMap({
  data,
  indicator,
  selectedMunicipality,
  selectedState,
  viewMode,
  onMunicipalitySelect,
  onStateSelect,
}: BrazilCrimeMapProps) {
  const cityCollection = useMemo(() => createCityFeatureCollection(data, indicator, viewMode), [data, indicator, viewMode]);
  const selectedCityCollection = useMemo(
    () => createCityFeatureCollection(selectedMunicipality ? [selectedMunicipality] : [], indicator, viewMode),
    [indicator, selectedMunicipality, viewMode],
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const dataRef = useRef(data);
  const onMunicipalitySelectRef = useRef(onMunicipalitySelect);
  const onStateSelectRef = useRef(onStateSelect);
  const cityCollectionRef = useRef(cityCollection);
  const selectedCityCollectionRef = useRef(selectedCityCollection);
  const [isLoading, setIsLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; item: MunicipalityCrimeData } | null>(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    cityCollectionRef.current = cityCollection;
  }, [cityCollection]);

  useEffect(() => {
    selectedCityCollectionRef.current = selectedCityCollection;
  }, [selectedCityCollection]);

  useEffect(() => {
    onMunicipalitySelectRef.current = onMunicipalitySelect;
  }, [onMunicipalitySelect]);

  useEffect(() => {
    onStateSelectRef.current = onStateSelect;
  }, [onStateSelect]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    try {
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
        map.on("mousemove", "city-points", (event) => {
          map.getCanvas().style.cursor = "pointer";
          const feature = event.features?.[0];
          const idIbge = feature?.properties?.idIbge;
          const item = dataRef.current.find((municipality) => municipality.idIbge === idIbge);
          if (item) {
            setTooltip({ x: event.point.x, y: event.point.y, item });
          }
        });
        map.on("mouseleave", "city-points", () => {
          map.getCanvas().style.cursor = "";
          setTooltip(null);
        });
        map.on("mousemove", "states-fill", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "states-fill", () => {
          map.getCanvas().style.cursor = "";
        });

        map.fitBounds(
          [
            [-74.1, -34.2],
            [-34.7, 5.4],
          ],
          { padding: 42, duration: 0 },
        );
        setIsLoading(false);
      });

      map.on("error", () => {
        setMapError("Nao foi possivel carregar todos os recursos do mapa.");
      });
    } catch {
      window.setTimeout(() => {
        setMapError("Nao foi possivel inicializar o mapa.");
        setIsLoading(false);
      }, 0);
    }

    return () => {
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

    const [west, south, east, north] = getBoundsForState(selectedState);
    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: selectedState ? 96 : 42, duration: 900 },
    );
  }, [selectedMunicipality, selectedState]);

  return (
    <div className="relative h-full min-h-[620px]">
      <div ref={containerRef} className="absolute inset-0" />
      {isLoading ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/70">
          <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200">
            <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
            Carregando mapa
          </div>
        </div>
      ) : null}
      {mapError ? (
        <div className="absolute right-4 top-20 z-20 flex max-w-sm items-start gap-3 rounded-lg border border-red-300/20 bg-red-950/80 p-3 text-sm text-red-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {mapError}
        </div>
      ) : null}
      {!isLoading && data.length === 0 ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/50">
          <p className="rounded-lg border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-300">
            Nenhum dado demonstrativo encontrado para este periodo.
          </p>
        </div>
      ) : null}
      <MapTooltip indicator={indicator} tooltip={tooltip} />
    </div>
  );
}
