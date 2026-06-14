// Orquestrador da camada OSINT: artigos -> extracao IA -> geocoding -> dedupe.
// As dependencias (extrator e geocoder) sao injetaveis para testes offline.
import type { NewsIncident, NewsExtraction, RawArticle } from "@/types/news";
import { extractArticle, type ExtractResult } from "@/server/osint/providers";
import { geocode, type GeoMatch } from "@/server/osint/geocode";

export interface PipelineDeps {
  extractor: (a: RawArticle) => Promise<ExtractResult | null>;
  geocoder: (municipio: string | null, uf: string | null) => GeoMatch | null;
  now: () => string; // ISO datetime (injetavel p/ testes deterministicos)
}

const defaultDeps: PipelineDeps = {
  extractor: extractArticle,
  geocoder: geocode,
  now: () => new Date().toISOString(),
};

// Hash estavel (djb2) -> base36. Suficiente p/ chave de dedupe (nao cripto).
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// Chave de dedupe: mesma ocorrencia coberta por varios veiculos colapsa.
// (tipo, uf, municipio normalizado, dia). Mantem a de MAIOR confianca.
function dedupeKey(tipo: string, uf: string, municipio: string, dia: string | null): string {
  return `${tipo}|${uf}|${municipio.toLowerCase()}|${dia ?? "?"}`;
}

// Confianca minima para nao cair direto em revisao manual (heuristica inicial).
const AUTO_CONFIRM_THRESHOLD = 0.75;

function toIncident(
  ex: NewsExtraction,
  geo: GeoMatch | null,
  a: RawArticle,
  provedor: string,
  now: string,
): NewsIncident {
  const municipio = geo?.municipio ?? ex.municipio ?? "Desconhecido";
  const uf = geo?.uf ?? ex.uf ?? "??";
  const dia = ex.dataOcorrencia ?? (a.publicadoEm ? a.publicadoEm.slice(0, 10) : null);
  // Sem geocoding, a confianca cai (nao sabemos posicionar no mapa com seguranca).
  const confianca = geo ? ex.confianca : Math.min(ex.confianca, 0.4);
  return {
    id: hash(dedupeKey(ex.tipo, uf, municipio, dia) + "|" + new URL(a.url).hostname),
    tipo: ex.tipo,
    municipio,
    uf,
    idIbge: geo?.idIbge ?? null,
    lat: geo?.lat ?? null,
    lng: geo?.lng ?? null,
    vitimas: ex.vitimas,
    dataOcorrencia: dia,
    resumo: ex.resumo || a.titulo,
    fonteUrl: a.url,
    veiculo: a.veiculo,
    confianca,
    reviewStatus: confianca >= AUTO_CONFIRM_THRESHOLD && geo ? "confirmado" : "pendente",
    extraidoEm: now,
    provedor,
  };
}

export interface PipelineResult {
  incidents: NewsIncident[];
  stats: { artigos: number; extraidos: number; descartados: number; deduplicados: number };
}

// Processa uma lista de artigos em incidentes geolocalizados e deduplicados.
export async function runPipeline(
  articles: RawArticle[],
  deps: Partial<PipelineDeps> = {},
): Promise<PipelineResult> {
  const { extractor, geocoder, now } = { ...defaultDeps, ...deps };
  const byKey = new Map<string, NewsIncident>();
  let extraidos = 0;
  let descartados = 0;

  for (const a of articles) {
    const res = await extractor(a);
    if (!res || !res.extraction.ehCrimeViolento) {
      descartados++;
      continue;
    }
    extraidos++;
    const geo = geocoder(res.extraction.municipio, res.extraction.uf);
    const inc = toIncident(res.extraction, geo, a, res.provedor, now());
    const key = dedupeKey(inc.tipo, inc.uf, inc.municipio, inc.dataOcorrencia);
    const prev = byKey.get(key);
    if (!prev || inc.confianca > prev.confianca) byKey.set(key, inc);
  }

  const incidents = [...byKey.values()].sort((x, y) => y.confianca - x.confianca);
  return {
    incidents,
    stats: {
      artigos: articles.length,
      extraidos,
      descartados,
      deduplicados: extraidos - incidents.length,
    },
  };
}
