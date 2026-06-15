// Orquestrador da camada OSINT: artigos -> extracao IA -> geocoding -> dedupe
// cross-source. As dependencias (extrator e geocoder) sao injetaveis p/ testes.
//
// Dedupe: a MESMA ocorrencia coberta por varios veiculos vira UM incidente que
// PRESERVA todas as fontes (corroboracao). Em vez de manter so o artigo de maior
// confianca (descartando os outros), agrupa-os e soma a corroboracao na confianca.
// Tudo deterministico (sem embeddings/sem rede) -> reexecutavel/idempotente.
import type { NewsIncident, NewsExtraction, NewsSource, RawArticle } from "@/types/news";
import { createExtractor, type ExtractResult } from "@/server/osint/providers";
import { geocode, normalizeName, type GeoMatch } from "@/server/osint/geocode";
import { articleTokens, jaccard } from "@/server/osint/similarity";

export interface PipelineDeps {
  extractor: (a: RawArticle) => Promise<ExtractResult | null>;
  geocoder: (municipio: string | null, uf: string | null) => GeoMatch | null;
  now: () => string; // ISO datetime (injetavel p/ testes deterministicos)
}

// Parametros de dedupe (levers — ajustaveis). Nunca juntar so pela janela:
// exige tambem similaridade textual (evita colapsar crimes distintos na mesma
// cidade/dia). Texto muito similar (SIM_HIGH) junta mesmo com datas divergentes.
const WINDOW_DAYS = 3;
const SIM_LOW = 0.3; // so vale combinado com a janela
const SIM_HIGH = 0.55; // forte o bastante p/ juntar sozinho
const BOOST_PER_EXTRA = 0.1; // +0.1 de confianca por veiculo extra (cap 1)
const AUTO_CONFIRM_THRESHOLD = 0.75; // abaixo disso (ou sem geo) -> revisao manual
const UNGEO_CONF_CAP = 0.4; // sem geo, confianca nunca passa disto (nem com corroboracao)

// Hash estavel (djb2) -> base36. Suficiente p/ id (nao cripto).
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// Diferenca em dias entre duas datas "YYYY-MM-DD" (ou null). null = sem restricao.
function daysApart(a: string | null, b: string | null): number {
  if (!a || !b) return 0; // sem data nao bloqueia a janela (similaridade decide)
  const da = Date.parse(a + "T00:00:00Z");
  const db = Date.parse(b + "T00:00:00Z");
  if (Number.isNaN(da) || Number.isNaN(db)) return 0;
  return Math.abs(da - db) / 86_400_000;
}

// Candidato: um artigo aceito (crime), com o que precisamos p/ agrupar e montar.
interface Candidate {
  source: NewsSource;
  tipo: NewsExtraction["tipo"];
  geo: GeoMatch | null;
  dia: string | null; // dataOcorrencia ?? data de publicacao
  resumo: string;
  vitimas: number | null;
  tokens: Set<string>;
}

// Dois candidatos cobrem a mesma ocorrencia? (ja estao no mesmo bucket).
function mergeable(a: Candidate, b: Candidate): boolean {
  if (a.source.fonteUrl === b.source.fonteUrl) return true; // mesmo artigo
  const sim = jaccard(a.tokens, b.tokens);
  if (sim >= SIM_HIGH) return true;
  return sim >= SIM_LOW && daysApart(a.dia, b.dia) <= WINDOW_DAYS;
}

// Ordena candidatos p/ clusterizacao deterministica (independe da ordem de entrada).
function byPubThenUrl(a: Candidate, b: Candidate): number {
  const pa = a.source.publicadoEm ?? "";
  const pb = b.source.publicadoEm ?? "";
  if (pa !== pb) return pa < pb ? -1 : 1;
  return a.source.fonteUrl < b.source.fonteUrl ? -1 : a.source.fonteUrl > b.source.fonteUrl ? 1 : 0;
}

// Fonte primaria: maior confianca; desempate por fonteUrl asc (total/estavel).
function bySourceStrength(a: NewsSource, b: NewsSource): number {
  if (a.confianca !== b.confianca) return b.confianca - a.confianca;
  return a.fonteUrl < b.fonteUrl ? -1 : a.fonteUrl > b.fonteUrl ? 1 : 0;
}

// Clusteriza um bucket: guloso, single-link contra o REPRESENTANTE (1o do cluster)
// — garante o mesmo agrupamento em qualquer ordem de entrada (idempotencia).
function cluster(bucket: Candidate[]): Candidate[][] {
  const sorted = [...bucket].sort(byPubThenUrl);
  const used = new Array(sorted.length).fill(false);
  const clusters: Candidate[][] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const group = [sorted[i]];
    for (let j = i + 1; j < sorted.length; j++) {
      if (!used[j] && mergeable(sorted[i], sorted[j])) {
        used[j] = true;
        group.push(sorted[j]);
      }
    }
    clusters.push(group);
  }
  return clusters;
}

// Monta o incidente final a partir de um cluster de candidatos corroborantes.
function buildIncident(group: Candidate[], now: string): NewsIncident {
  const fontes = group.map((c) => c.source).sort(bySourceStrength);
  const primary = group.slice().sort((a, b) => bySourceStrength(a.source, b.source))[0];
  const geo = primary.geo;
  // Corroboracao = veiculos DISTINTOS. Conta por veiculo (nao por hostname): no
  // Google News todo link e do host news.google.com, mas o veiculo real vem do
  // <source> (G1, CNN...). O rotulo fallback ("Google Notícias") colapsa em 1
  // (conservador — nunca infla corroboracao de itens sem veiculo identificado).
  const corroboracao = new Set(fontes.map((f) => f.veiculo)).size;

  // Data canonica do incidente: a mais antiga (deterministica) entre as fontes.
  const dia = group.map((c) => c.dia).filter((d): d is string => !!d).sort()[0] ?? null;

  const base = Math.max(...fontes.map((f) => f.confianca));
  let confianca = Math.min(1, base + BOOST_PER_EXTRA * (corroboracao - 1));
  if (!geo) confianca = Math.min(confianca, UNGEO_CONF_CAP);

  const municipio = geo?.municipio ?? "Desconhecido";
  const uf = geo?.uf ?? "??";
  // Id = funcao da IDENTIDADE + composicao do cluster. Inclui as URLs (ordenadas)
  // para nunca colidir entre clusters distintos do mesmo bucket (ex.: dois crimes
  // distintos na mesma cidade/tipo/dia). Estavel p/ a mesma entrada -> idempotente.
  const urlsKey = fontes.map((f) => f.fonteUrl).sort().join(",");
  const ident = geo
    ? `${primary.tipo}|${geo.uf}|${normalizeName(geo.municipio)}|${dia ?? "?"}`
    : `ungeo|${primary.tipo}`;
  const id = hash(`${ident}|${urlsKey}`);

  return {
    id,
    tipo: primary.tipo,
    municipio,
    uf,
    idIbge: geo?.idIbge ?? null,
    lat: geo?.lat ?? null,
    lng: geo?.lng ?? null,
    vitimas: primary.vitimas,
    dataOcorrencia: dia,
    resumo: primary.resumo || primary.source.titulo,
    fontes,
    corroboracao,
    fonteUrl: fontes[0].fonteUrl,
    veiculo: fontes[0].veiculo,
    provedor: fontes[0].provedor,
    confianca,
    reviewStatus: confianca >= AUTO_CONFIRM_THRESHOLD && geo ? "confirmado" : "pendente",
    extraidoEm: now,
  };
}

export interface PipelineResult {
  incidents: NewsIncident[];
  stats: {
    artigos: number;
    extraidos: number;
    descartados: number;
    deduplicados: number;
    fontesTotais: number;
    incidentesMultiFonte: number;
    porProvedor: Record<string, number>;
  };
}

// Processa uma lista de artigos em incidentes geolocalizados e deduplicados.
export async function runPipeline(
  articles: RawArticle[],
  deps: Partial<PipelineDeps> = {},
): Promise<PipelineResult> {
  const extractor = deps.extractor ?? createExtractor();
  const geocoder = deps.geocoder ?? geocode;
  const now = deps.now ?? (() => new Date().toISOString());

  const candidates: Candidate[] = [];
  const porProvedor: Record<string, number> = {};
  let descartados = 0;

  for (const a of articles) {
    const res = await extractor(a);
    if (!res || !res.extraction.ehCrimeViolento) {
      descartados++;
      continue;
    }
    const ex = res.extraction;
    const geo = geocoder(ex.municipio, ex.uf);
    porProvedor[res.provedor] = (porProvedor[res.provedor] ?? 0) + 1;
    candidates.push({
      source: {
        fonteUrl: a.url,
        veiculo: a.veiculo,
        provedor: res.provedor,
        confianca: ex.confianca,
        titulo: a.titulo,
        publicadoEm: a.publicadoEm,
      },
      tipo: ex.tipo,
      geo,
      dia: ex.dataOcorrencia ?? (a.publicadoEm ? a.publicadoEm.slice(0, 10) : null),
      resumo: ex.resumo,
      vitimas: ex.vitimas,
      tokens: articleTokens(a.titulo, ex.resumo),
    });
  }

  // Buckets: geocodificados por tipo|uf|municipio (canonico); o resto so por tipo
  // (nunca juntar mapeado com nao-mapeado -> evita colapsar "Desconhecido").
  const buckets = new Map<string, Candidate[]>();
  for (const c of candidates) {
    const key = c.geo
      ? `geo|${c.tipo}|${c.geo.uf}|${normalizeName(c.geo.municipio)}`
      : `ungeo|${c.tipo}`;
    const arr = buckets.get(key);
    if (arr) arr.push(c);
    else buckets.set(key, [c]);
  }

  const nowStr = now();
  const incidents: NewsIncident[] = [];
  for (const bucket of buckets.values()) {
    for (const group of cluster(bucket)) incidents.push(buildIncident(group, nowStr));
  }

  // Ordenacao final total (independente da ordem dos buckets): confianca desc, id asc.
  incidents.sort((x, y) => (y.confianca - x.confianca) || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));

  // Chaves de porProvedor ordenadas (saida deterministica/observavel).
  const porProvedorOrdenado: Record<string, number> = {};
  for (const k of Object.keys(porProvedor).sort()) porProvedorOrdenado[k] = porProvedor[k];

  return {
    incidents,
    stats: {
      artigos: articles.length,
      extraidos: candidates.length,
      descartados,
      deduplicados: candidates.length - incidents.length,
      fontesTotais: incidents.reduce((n, i) => n + i.fontes.length, 0),
      incidentesMultiFonte: incidents.filter((i) => i.corroboracao > 1).length,
      porProvedor: porProvedorOrdenado,
    },
  };
}
