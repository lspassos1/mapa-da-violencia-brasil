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

// --- Geocode por DICIONARIO a partir de TEXTO LIVRE (sem LLM) ---------------
// Extrai a cidade de uma manchete e resolve. Conservador p/ nao gerar incidente
// mal-localizado (a moldura e "indicio"): so aceita (a) CAPITAIS nao-ambiguas e
// (b) nomes de municipio UNICOS no Brasil com >=2 palavras. Single-word generico
// (Centro, Bonito, Natal...) fica de fora — vai pro LLM.

// Capitais (nome IBGE, UF). Exclui as ambiguas com palavra comum: Natal, Vitoria,
// Palmas, Boa Vista (viram falso positivo: "natal", "vitoria"...).
const CAPITAIS: [string, string][] = [
  ["Rio Branco", "AC"], ["Maceió", "AL"], ["Macapá", "AP"], ["Manaus", "AM"],
  ["Salvador", "BA"], ["Fortaleza", "CE"], ["Brasília", "DF"], ["Goiânia", "GO"],
  ["São Luís", "MA"], ["Cuiabá", "MT"], ["Campo Grande", "MS"], ["Belo Horizonte", "MG"],
  ["Belém", "PA"], ["João Pessoa", "PB"], ["Curitiba", "PR"], ["Recife", "PE"],
  ["Teresina", "PI"], ["Rio de Janeiro", "RJ"], ["Porto Alegre", "RS"], ["Porto Velho", "RO"],
  ["Florianópolis", "SC"], ["São Paulo", "SP"], ["Aracaju", "SE"],
];
// "Antes destes, a capital nao e o lugar do fato" -> nao geocodifica.
const CONTEXTO_NAO_LOCAL = /\b(interior|regiao|grande|estado|aeroporto)\b/;

let capIndex: Map<string, GeoMatch> | null = null;
let multiWordUnique: Map<string, GeoMatch> | null = null;

function buildDict() {
  if (!byMunUf) build();
  capIndex = new Map();
  for (const [nome, uf] of CAPITAIS) {
    const m = byMunUf!.get(`${normalizeName(nome)}|${uf.toLowerCase()}`);
    if (m) capIndex.set(normalizeName(nome), m);
  }
  // Nomes unicos com >=2 palavras (ex.: "feira de santana", "santa luzia do parua").
  multiWordUnique = new Map();
  for (const [nm, m] of byMunOnly!.entries()) {
    if (m && nm.includes(" ")) multiWordUnique.set(nm, m);
  }
}

// Nome presente no texto como palavra(s) inteira(s) E nao precedido de contexto
// "interior/regiao/grande/estado/aeroporto" (que indica que a capital nao e o
// local do fato).
function presentAsLocal(nm: string, norm: string): boolean {
  const i = norm.search(new RegExp(`(^|\\s)${nm}($|\\s)`));
  if (i < 0) return false;
  return !CONTEXTO_NAO_LOCAL.test(norm.slice(0, i + 1));
}

export function geocodeFromText(text: string): GeoMatch | null {
  if (!capIndex) buildDict();
  const norm = normalizeName(text);
  // 1) Capital nao-ambigua presente no texto.
  for (const [nm, m] of capIndex!.entries()) if (presentAsLocal(nm, norm)) return m;
  // 2) Nome unico multi-palavra (muito improvavel aparecer por acaso).
  for (const [nm, m] of multiWordUnique!.entries()) if (nm.length >= 8 && presentAsLocal(nm, norm)) return m;
  return null;
}
