// Geocoding da camada OSINT: resolve (municipio, uf) -> {idIbge, lat, lng}
// usando o indice compacto src/data/municipios.json (gerado por
// scripts/build_municipios_index.mjs a partir da carga oficial).
//
// Server-only: importa um JSON bundleado, sem fs/fetch em runtime (funciona
// igual em local e na Vercel).
import municipios from "@/data/municipios.json";

type Row = [idIbge: string, municipio: string, uf: string, lat: number, lng: number];

export interface GeoMatch {
  idIbge: string;
  municipio: string;
  uf: string;
  lat: number;
  lng: number;
}

// Normaliza nome: minusculas, sem acentos, so alfanumerico+espaco colapsado.
export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

let byMunUf: Map<string, GeoMatch> | null = null;
let byMunOnly: Map<string, GeoMatch | null> | null = null; // null = ambiguo

function build() {
  byMunUf = new Map();
  byMunOnly = new Map();
  for (const row of municipios as Row[]) {
    const [idIbge, municipio, uf, lat, lng] = row;
    const match: GeoMatch = { idIbge, municipio, uf, lat, lng };
    const nm = normalizeName(municipio);
    byMunUf.set(`${nm}|${uf.toLowerCase()}`, match);
    // indice so-nome: se o nome aparece em >1 UF, marca como ambiguo (null).
    byMunOnly.set(nm, byMunOnly.has(nm) ? null : match);
  }
}

// Resolve um municipio. Com UF e deterministico; sem UF, so resolve nomes unicos.
export function geocode(municipio: string | null, uf: string | null): GeoMatch | null {
  if (!municipio) return null;
  if (!byMunUf) build();
  const nm = normalizeName(municipio);
  if (uf) {
    const hit = byMunUf!.get(`${nm}|${uf.toLowerCase()}`);
    if (hit) return hit;
  }
  const only = byMunOnly!.get(nm);
  return only ?? null; // null tambem cobre o caso ambiguo
}
