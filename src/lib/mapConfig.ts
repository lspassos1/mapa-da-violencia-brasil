// Configuracao do mapa base (tiles). Por omissao usa os quatro subdominios
// publicos do CARTO (dark_all) para distribuir a carga de tiles e evitar o
// ponto unico de falha do subdominio "a". Pode ser sobreposto por ambiente.

const DEFAULT_TILE_URLS = ["a", "b", "c", "d"].map(
  (subdomain) => `https://${subdomain}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png`,
);

const DEFAULT_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, © <a href="https://carto.com/attributions">CARTO</a>';

function parseTileUrls(raw: string | undefined): string[] {
  if (!raw) {
    return DEFAULT_TILE_URLS;
  }
  const urls = raw
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
  return urls.length > 0 ? urls : DEFAULT_TILE_URLS;
}

// Lista de URLs de tiles. O MapLibre distribui os pedidos pelas varias URLs
// (o equivalente aos subdominios a/b/c/d, ja que nao suporta o template {s}).
export const mapTileUrls: string[] = parseTileUrls(process.env.NEXT_PUBLIC_MAP_TILE_URLS);

export const mapTileAttribution: string =
  process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION ?? DEFAULT_ATTRIBUTION;
