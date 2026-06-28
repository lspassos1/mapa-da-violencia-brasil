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

// Pista de logradouro/bairro/ponto de referencia IMEDIATAMENTE antes do nome:
// indica que o nome casado e um BAIRRO/rua/igreja homonimo, NAO o municipio do
// fato. Sem isto, nomes de municipio que tambem sao bairros/santos/ruas comuns
// ("santo antonio", "sao jose", "bela vista", "nova esperanca") geocodificavam
// para o estado errado (ex.: "no bairro Santo Antonio" -> Santo Antonio/RN).
const LUGAR_NAO_MUNICIPIO =
  /\b(?:bairro|comunidade|favela|vila|conjunto|loteamento|condominio|distrito|povoado|morro|rua|avenida|alameda|travessa|estrada|rodovia|praca|largo|igreja|paroquia|capela|catedral|santuario|hospital|presidio|penitenciaria)\s+$/;

// Entrada do dicionario com o regex JA COMPILADO (nomes sao normalizados ->
// alfanumerico, sem chars especiais de regex). Compilado 1x no build, nao por
// chamada (o pool de artigos pode ser grande).
interface DictEntry {
  re: RegExp;
  geo: GeoMatch;
}
const MINLEN_UNICO = 8; // nome unico multi-palavra precisa ser longo (evita acaso)
let capList: DictEntry[] | null = null;
let multiList: DictEntry[] | null = null;

function buildDict() {
  if (!byMunUf) build();
  const word = (nm: string): RegExp => new RegExp(`(^|\\s)${nm}($|\\s)`);
  capList = [];
  for (const [nome, uf] of CAPITAIS) {
    const m = byMunUf!.get(`${normalizeName(nome)}|${uf.toLowerCase()}`);
    if (m) capList.push({ re: word(normalizeName(nome)), geo: m });
  }
  // Nomes unicos no Brasil, multi-palavra e longos (ex.: "feira de santana").
  multiList = [];
  for (const [nm, m] of byMunOnly!.entries()) {
    if (m && nm.includes(" ") && nm.length >= MINLEN_UNICO) multiList.push({ re: word(nm), geo: m });
  }
}

// Casa o nome no texto, rejeitando quando o prefixo indica que NAO e o municipio
// do fato: "interior/regiao/..." (a capital nao e o local) ou "bairro/rua/igreja..."
// imediatamente antes (logradouro/bairro homonimo, nao o municipio).
function matchLocal(e: DictEntry, norm: string): boolean {
  const i = norm.search(e.re);
  if (i < 0) return false;
  const prefixo = norm.slice(0, i + 1);
  return !CONTEXTO_NAO_LOCAL.test(prefixo) && !LUGAR_NAO_MUNICIPIO.test(prefixo);
}

export function geocodeFromText(text: string): GeoMatch | null {
  if (!capList) buildDict();
  const norm = normalizeName(text);
  for (const e of capList!) if (matchLocal(e, norm)) return e.geo; // 1) capital
  for (const e of multiList!) if (matchLocal(e, norm)) return e.geo; // 2) único multi-palavra
  return null;
}
