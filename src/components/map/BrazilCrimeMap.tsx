"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { AlertCircle, Loader2 } from "lucide-react";
import { getScoreColor, getScoreRadius } from "@/lib/colorScale";
import { getMetricValueFromMetric } from "@/lib/crimeMetrics";
import { formatMetricValue } from "@/lib/formatters";
import { mapTileAttribution, mapTileUrls } from "@/lib/mapConfig";
import { getBoundsForData, getBoundsForState, getMunicipalityBounds } from "@/lib/mapNavigation";
import {
  buildMunicipalFillColorExpression,
  buildStateFillColorExpression,
  computeMunicipalChoropleth,
  computeStateChoropleth,
  createStateFeatureCollection,
} from "@/services/geoService";
import { loadStateMunicipalMesh } from "@/services/geoMeshService";
import type { CrimeIndicatorKey, MunicipalityCrimeData, ViewMode } from "@/types/crime";
import type { GeoFeatureCollection } from "@/types/geo";
import { MapTooltip } from "./MapTooltip";

const EMPTY_FC: GeoFeatureCollection = { type: "FeatureCollection", features: [] };

interface BrazilCrimeMapProps {
  data: MunicipalityCrimeData[];
  indicator: CrimeIndicatorKey;
  selectedMunicipality: MunicipalityCrimeData | null;
  selectedState: string | null;
  viewMode: ViewMode;
  onMunicipalitySelect: (item: MunicipalityCrimeData) => void;
  onStateSelect: (uf: string) => void;
}

const BRAZIL_VIEWPORT = {
  west: -74.1,
  south: -34.2,
  east: -34.7,
  north: 5.4,
};

// Enquadramento nacional: usa a extensao real dos dados visiveis (ex.: uma
// amostra regional) com recuo, caindo no Brasil inteiro quando nao ha dados.
function getNationalBounds(data: MunicipalityCrimeData[]): [number, number, number, number] {
  return (
    getBoundsForData(data) ?? [
      BRAZIL_VIEWPORT.west,
      BRAZIL_VIEWPORT.south,
      BRAZIL_VIEWPORT.east,
      BRAZIL_VIEWPORT.north,
    ]
  );
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
  // Coropletico por UF (degrade de violencia) para o indicador/modo atuais.
  const stateFillColor = useMemo(
    () => buildStateFillColorExpression(computeStateChoropleth(data, indicator, viewMode)),
    [data, indicator, viewMode],
  );
  // Coropletico municipal (cores por id_ibge) do estado aberto, para pintar os
  // poligonos das cidades pelo indice. Vazio ao nivel nacional.
  const municipalFillColor = useMemo(
    () =>
      buildMunicipalFillColorExpression(
        selectedState ? computeMunicipalChoropleth(data, indicator, selectedState) : [],
      ),
    [data, indicator, selectedState],
  );
  const stateFillColorRef = useRef(stateFillColor);
  // Verdadeiro apos o evento 'load' (estilo + camadas prontos). Guardamos os
  // effects por este ref em vez de map.isStyleLoaded(), que tambem fica falso
  // enquanto os tiles carregam — o que fazia fitBounds/pintura sair cedo (sem
  // zoom e com o degrade obsoleto) ao selecionar um estado.
  const styleReadyRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const dataRef = useRef(data);
  const onMunicipalitySelectRef = useRef(onMunicipalitySelect);
  const onStateSelectRef = useRef(onStateSelect);
  const [isLoading, setIsLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [useStaticFallback, setUseStaticFallback] = useState(false);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; item: MunicipalityCrimeData } | null>(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    stateFillColorRef.current = stateFillColor;
  }, [stateFillColor]);

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
                tiles: mapTileUrls,
                tileSize: 256,
                attribution: mapTileAttribution,
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
          // Malha municipal do estado aberto (carregada sob demanda no clique).
          map.addSource("municipios", {
            type: "geojson",
            data: EMPTY_FC,
            promoteId: "id",
          });

          map.addLayer({
            id: "states-fill",
            type: "fill",
            source: "states",
            paint: {
              // Coropletico: cada UF recebe a cor do seu nivel de violencia.
              "fill-color": stateFillColorRef.current as never,
              "fill-opacity": 0.55,
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
          // Municipios do estado aberto: preenchimento coropletico por indice e
          // fronteiras reais (substitui os antigos circulos).
          map.addLayer({
            id: "municipios-fill",
            type: "fill",
            source: "municipios",
            paint: {
              "fill-color": "#334155",
              "fill-opacity": 0.78,
            },
          });
          map.addLayer({
            id: "municipios-line",
            type: "line",
            source: "municipios",
            paint: {
              "line-color": "#0f172a",
              "line-opacity": 0.55,
              "line-width": 0.6,
            },
          });
          map.addLayer({
            id: "selected-municipio-line",
            type: "line",
            source: "municipios",
            filter: ["==", ["get", "id"], ""],
            paint: {
              "line-color": "#f8fafc",
              "line-opacity": 0.95,
              "line-width": 2.4,
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

          map.on("click", "states-fill", (event) => {
            const feature = event.features?.[0];
            const uf = feature?.properties?.uf;
            if (typeof uf === "string") {
              onStateSelectRef.current(uf);
            }
          });
          map.on("click", "municipios-fill", (event) => {
            const feature = event.features?.[0];
            const idIbge = feature?.properties?.id;
            const item = dataRef.current.find((municipality) => municipality.idIbge === idIbge);
            if (item) {
              onMunicipalitySelectRef.current(item);
            }
          });
          map.on("mousemove", "municipios-fill", (event) => {
            map.getCanvas().style.cursor = "pointer";
            const feature = event.features?.[0];
            const idIbge = feature?.properties?.id;
            const item = dataRef.current.find((municipality) => municipality.idIbge === idIbge);
            if (item) {
              setTooltip({ x: event.point.x, y: event.point.y, item });
            } else {
              setTooltip(null);
            }
          });
          map.on("mouseleave", "municipios-fill", () => {
            map.getCanvas().style.cursor = "";
            setTooltip(null);
          });
          map.on("mousemove", "states-fill", () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", "states-fill", () => {
            map.getCanvas().style.cursor = "";
          });

          const [initWest, initSouth, initEast, initNorth] = getNationalBounds(dataRef.current);
          map.fitBounds(
            [
              [initWest, initSouth],
              [initEast, initNorth],
            ],
            { padding: 48, maxZoom: 7, duration: 0 },
          );
          // Garante que o canvas iguala o tamanho final do container (apos o
          // layout do grid assentar), evitando um mapa renderizado a meio.
          map.resize();
          styleReadyRef.current = true;
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

  // Carrega (sob demanda) a malha municipal do estado aberto; ao nivel nacional
  // limpa a fonte para que so o degrade dos estados fique visivel.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) {
      return;
    }
    const source = map.getSource("municipios") as GeoJSONSource | undefined;
    if (!source) {
      return;
    }
    if (!selectedState) {
      source.setData(EMPTY_FC);
      return;
    }
    let cancelled = false;
    void loadStateMunicipalMesh(selectedState).then((mesh) => {
      // `cancelled` (via cleanup) garante que so a malha do estado atual e escrita.
      if (cancelled) {
        return;
      }
      const current = mapRef.current?.getSource("municipios") as GeoJSONSource | undefined;
      current?.setData(mesh);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedState]);

  // Pinta os municipios pelo indice (degrade) e realca o municipio selecionado.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) {
      return;
    }
    map.setPaintProperty("municipios-fill", "fill-color", municipalFillColor as never);
    map.setFilter("selected-municipio-line", ["==", ["get", "id"], selectedMunicipality?.idIbge ?? ""]);
  }, [municipalFillColor, selectedMunicipality]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) {
      return;
    }
    map.setFilter("selected-state-line", ["==", ["get", "uf"], selectedState ?? ""]);

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

    // Com estado selecionado, enquadra o estado; ao nivel nacional, enquadra a
    // extensao dos dados visiveis (cai no Brasil inteiro quando ha dados em todo
    // o pais ou quando nao ha dados).
    const [west, south, east, north] = selectedState
      ? getBoundsForState(selectedState)
      : getNationalBounds(dataRef.current);
    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: selectedState ? 96 : 48, maxZoom: selectedState ? undefined : 7, duration: 900 },
    );
  }, [selectedMunicipality, selectedState]);

  // Degrade coropletico das UFs: atualiza a cor por nivel de violencia ao mudar
  // indicador/modo/periodo e realca a UF selecionada (atenuando as restantes),
  // sem re-enquadrar o mapa.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) {
      return;
    }
    map.setPaintProperty("states-fill", "fill-color", stateFillColor as never);
    map.setPaintProperty(
      "states-fill",
      "fill-opacity",
      selectedState
        ? ["case", ["==", ["get", "uf"], selectedState], 0.78, 0.28]
        : 0.55,
    );
  }, [stateFillColor, selectedState]);

    /* Altura fixa de viewport (nao "h-full"): no grid lg, a coluna de filtros
       e alta e esticava a celula do mapa para ~1384px, mas o canvas do MapLibre
       ficava nos ~600px iniciais — deixando o resto preto (mapa "invisivel"). Uma
       altura propria e estavel resolve, e `self-start` evita o esticamento. */
  return (
    <div className="relative h-[78vh] min-h-[620px] max-h-[920px] self-start">
      {/* O MapLibre forca `position: relative` na sua div (.maplibregl-map),
          sobrepondo-se ao `absolute` do Tailwind e anulando o `inset-0`. Damos
          altura explicita (h-full do wrapper de altura fixa) para o mapa preencher. */}
      <div ref={containerRef} className="absolute inset-0 z-0 h-full w-full" />
      {useStaticFallback ? (
        <StaticCrimeMapFallback
          data={data}
          indicator={indicator}
          selectedMunicipality={selectedMunicipality}
          selectedState={selectedState}
          viewMode={viewMode}
          onMunicipalitySelect={onMunicipalitySelect}
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
      {!isLoading && data.length === 0 ? (
        <div className="absolute inset-0 z-[2] flex items-center justify-center bg-slate-950/50">
          <p className="rounded-lg border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-300">
            Nenhum dado demonstrativo encontrado para este periodo.
          </p>
        </div>
      ) : null}
      <MapTooltip indicator={indicator} tooltip={tooltip} />
    </div>
  );
}

function StaticCrimeMapFallback({
  data,
  indicator,
  selectedMunicipality,
  selectedState,
  viewMode,
  onMunicipalitySelect,
  onStateSelect,
}: BrazilCrimeMapProps) {
  const states = useMemo(() => Array.from(new Set(data.map((item) => item.uf))).sort(), [data]);

  return (
    <div className="absolute inset-0 z-[1] overflow-hidden bg-[radial-gradient(circle_at_50%_45%,rgba(14,165,233,0.18),rgba(15,23,42,0.96)_58%)]">
      <div className="absolute inset-x-10 bottom-16 top-24 rounded-[42%] border border-cyan-300/15 bg-cyan-300/[0.03]" />
      <div className="absolute right-4 top-20 max-w-[260px] rounded-lg border border-white/10 bg-slate-950/85 p-3 text-xs leading-5 text-slate-300 shadow-xl backdrop-blur">
        <p className="font-semibold text-slate-100">Mapa estatico</p>
        <p className="mt-1">WebGL indisponivel; exibindo posicoes aproximadas dos municipios.</p>
      </div>
      <div className="absolute bottom-8 right-4 flex max-w-[300px] flex-wrap justify-end gap-2">
        {states.map((uf) => (
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
