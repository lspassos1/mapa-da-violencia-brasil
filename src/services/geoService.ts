import brazilStatesMesh from "@/data/brazilStatesMesh.json";
import { brazilBounds, stateMapData } from "@/data/stateGeometries";
import { getScoreColor, getScoreRadius, riskColors } from "@/lib/colorScale";
import { getMetricValueFromMetric } from "@/lib/crimeMetrics";
import type { CrimeIndicatorKey, MunicipalityCrimeData, ViewMode } from "@/types/crime";
import type { Bounds, GeoFeatureCollection, StateMapInfo } from "@/types/geo";

// Escala sequencial (do menor para o maior nivel de violencia) usada no
// preenchimento coropletico das UFs.
const STATE_FILL_SCALE = [
  riskColors.baixo,
  riskColors.moderado,
  riskColors.atencao,
  riskColors.alto,
  riskColors.critico,
];

// Cinza para UFs sem dados no indicador/periodo selecionado.
const STATE_FILL_FALLBACK = "#334155";

// Escala DIVERGENTE para a variacao anual: verde = queda (melhorou), cinza =
// estavel (±5%), vermelho = subida (piorou). Null (ano parcial/sem ano
// anterior) cai no cinza de fallback.
export function getVariationColor(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return STATE_FILL_FALLBACK;
  }
  if (value <= -25) return "#15803d";
  if (value <= -5) return "#4ade80";
  if (value < 5) return "#94a3b8";
  if (value < 25) return "#fb923c";
  return "#dc2626";
}

export interface StateChoroplethEntry {
  uf: string;
  value: number;
  color: string;
}

// Agrega o indicador selecionado por UF (soma das vitimas; taxa por 100 mil
// quando o modo e taxa) e mapeia cada UF a uma cor por quantil de rank, para
// que o mapa mostre um degrade real de violencia entre os estados.
export function computeStateChoropleth(
  data: MunicipalityCrimeData[],
  indicator: CrimeIndicatorKey,
  viewMode: ViewMode,
): StateChoroplethEntry[] {
  const totals = new Map<string, { count: number; pop: number }>();
  for (const item of data) {
    const metric = item.indicadores[indicator];
    if (!metric || metric.dataStatus === "sem_dados" || metric.dataStatus === "nao_aplicavel") {
      continue;
    }
    const entry = totals.get(item.uf) ?? { count: 0, pop: 0 };
    entry.count += metric.total ?? 0;
    entry.pop += item.populacao ?? 0;
    totals.set(item.uf, entry);
  }

  const useRate = viewMode === "taxa100k";
  const entries: StateChoroplethEntry[] = [...totals.entries()].map(([uf, agg]) => ({
    uf,
    value: useRate ? (agg.pop > 0 ? (agg.count / agg.pop) * 100000 : 0) : agg.count,
    color: STATE_FILL_FALLBACK,
  }));

  const sorted = [...entries].sort((a, b) => a.value - b.value);
  const n = sorted.length;
  sorted.forEach((row, index) => {
    const bucket = Math.min(STATE_FILL_SCALE.length - 1, Math.floor((index / n) * STATE_FILL_SCALE.length));
    row.color = STATE_FILL_SCALE[bucket];
  });
  return entries;
}

// Constroi a expressao `fill-color` (MapLibre) para a camada de estados a
// partir do coropletico. UFs sem dados caem no cinza de fallback.
export function buildStateFillColorExpression(
  choropleth: StateChoroplethEntry[],
): unknown {
  if (choropleth.length === 0) {
    return STATE_FILL_FALLBACK;
  }
  const match: unknown[] = ["match", ["get", "uf"]];
  for (const entry of choropleth) {
    match.push(entry.uf, entry.color);
  }
  match.push(STATE_FILL_FALLBACK);
  return match;
}

// Degrade dos estados para indicadores so-UF. A cor vem do `score` ja calculado
// no ETL (mesmos limiares de getScoreColor), garantindo que a cor do mapa e o
// `nivel` exibido no ranking/painel nunca discordam nas fronteiras das faixas.
export function computeStateChoroplethFromUf(
  ufData: ReadonlyArray<{
    uf: string;
    score: number;
    total: number;
    taxa100k: number | null;
    variacaoAnual?: number | null;
  }>,
  viewMode: ViewMode,
): StateChoroplethEntry[] {
  // Variacao anual: escala divergente propria (verde=queda, vermelho=subida).
  if (viewMode === "variacaoAnual") {
    return ufData.map((datum) => ({
      uf: datum.uf,
      value: datum.variacaoAnual ?? 0,
      color: getVariationColor(datum.variacaoAnual),
    }));
  }
  const useRate = viewMode === "taxa100k";
  return ufData.map((datum) => ({
    uf: datum.uf,
    value: useRate ? datum.taxa100k ?? 0 : datum.total,
    color: getScoreColor(datum.score),
  }));
}

// Cor por id_ibge dos municipios de uma UF (degrade por indice). Usada para
// injetar `properties.color` em cada poligono e pintar com ["get","color"] —
// evita uma expressao `match` com centenas de ramos (que pode travar o GPU).
export function municipalColorById(
  data: MunicipalityCrimeData[],
  indicator: CrimeIndicatorKey,
  uf: string,
  viewMode: ViewMode = "score",
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const item of data) {
    if (item.uf !== uf) {
      continue;
    }
    const metric = item.indicadores[indicator];
    if (!metric || metric.dataStatus === "sem_dados" || metric.dataStatus === "nao_aplicavel") {
      continue;
    }
    // No modo variacao anual o degrade municipal e divergente; nos restantes,
    // a cor vem do indice (score), como sempre.
    out[item.idIbge] =
      viewMode === "variacaoAnual" ? getVariationColor(metric.variacaoAnual) : getScoreColor(metric.score);
  }
  return out;
}

// Clona a malha injetando `properties.color` por id_ibge (fallback para sem dado).
export function colorizeMunicipalMesh(
  mesh: GeoFeatureCollection,
  colorById: Record<string, string>,
): GeoFeatureCollection {
  return {
    type: "FeatureCollection",
    features: mesh.features.map((feature) => {
      const id = String((feature.properties as { id?: string } | undefined)?.id ?? "");
      return {
        ...feature,
        properties: { ...feature.properties, color: colorById[id] ?? STATE_FILL_FALLBACK },
      };
    }),
  };
}

// Malha estadual real (poligonos IBGE simplificados, qualidade intermediaria)
// com propriedades { uf, nome }. Substitui as caixas retangulares para que o
// preenchimento, as fronteiras e o clique sigam o contorno real de cada UF.
const stateMeshCollection = brazilStatesMesh as GeoFeatureCollection;

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
  return stateMeshCollection;
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
