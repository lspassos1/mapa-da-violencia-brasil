import type { GeoFeatureCollection } from "@/types/geo";

// Carrega, sob demanda, a malha municipal (poligonos) de um estado a partir de
// public/geo/municipios/{UF}.json.gz. Mesma origem (sem implicacoes de CSP); o
// ficheiro e servido gzipado e descomprimido no cliente com DecompressionStream.
// Cacheado por UF para nao rebuscar ao reabrir o mesmo estado.

const EMPTY: GeoFeatureCollection = { type: "FeatureCollection", features: [] };

const cache = new Map<string, Promise<GeoFeatureCollection>>();

export function municipalMeshUrl(uf: string): string {
  return `/geo/municipios/${uf.toUpperCase()}.json.gz`;
}

export function loadStateMunicipalMesh(uf: string): Promise<GeoFeatureCollection> {
  const key = uf.toUpperCase();
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }
  const promise = fetch(municipalMeshUrl(key))
    .then(async (response) => {
      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }
      const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
      return (await new Response(stream).json()) as GeoFeatureCollection;
    })
    .catch((error) => {
      if (typeof console !== "undefined") {
        console.warn(`[geoMeshService] Falha ao carregar malha de ${key}: ${String(error)}.`);
      }
      // Remove do cache para permitir nova tentativa num proximo clique.
      cache.delete(key);
      return EMPTY;
    });
  cache.set(key, promise);
  return promise;
}
