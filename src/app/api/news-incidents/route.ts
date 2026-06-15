// GET /api/news-incidents — camada OSINT (indicios de noticias, NAO base oficial).
// Pipeline: feeds RSS -> extracao por IA (rodizio AI_*) -> geocoding -> dedupe.
// Server-only; chaves nunca expostas ao cliente. Cache em memoria + single-flight
// (chamadas concorrentes a frio aguardam a MESMA execucao, sem multiplicar custo).
import { NextResponse } from "next/server";
import { fetchRss } from "@/server/osint/rss";
import { runPipeline } from "@/server/osint/pipeline";
import { configuredProviderCount } from "@/server/osint/providers";
import { DEFAULT_FEEDS } from "@/server/osint/feeds";
import type { NewsIncident, NewsReviewStatus, RawArticle } from "@/types/news";

export const dynamic = "force-dynamic";

// Teto de artigos por execucao (custo de IA no free tier). Override por env p/
// afinar sem deploy. O dedupe cross-source colapsa duplicatas depois.
// Checagem explicita de undefined p/ permitir OSINT_MAX_ARTICLES=0 (desligar).
const MAX_ARTICLES =
  process.env.OSINT_MAX_ARTICLES !== undefined ? Number(process.env.OSINT_MAX_ARTICLES) : 25;
const TTL_MS = 10 * 60 * 1000; // 10 min

interface NewsPayload {
  incidents: NewsIncident[];
  meta: Record<string, unknown>;
}

// Cache em memoria + single-flight. SEAM: aqui entraria, no follow-up, um
// IncidentStore.upsert(incidents) (tabela news_incidents no Supabase). O pipeline
// ja e deterministico/idempotente por execucao; o store persistente deve casar
// incidentes entre execucoes por identidade semantica (tipo/uf/municipio/janela),
// nao so pelo id (que depende da composicao de fontes daquela execucao). Por ora, stateless.
let cache: { at: number; payload: NewsPayload } | null = null;
let inflight: Promise<NewsPayload> | null = null;

const REVIEW_STATUSES: readonly NewsReviewStatus[] = ["pendente", "confirmado", "rejeitado"];

function aiConfigured(): boolean {
  return configuredProviderCount() > 0;
}

async function buildPayload(): Promise<NewsPayload> {
  const articles: RawArticle[] = [];
  for (const feed of DEFAULT_FEEDS) {
    try {
      articles.push(...(await fetchRss(feed.url, feed.veiculo)));
    } catch {
      // ignora feed indisponivel
    }
  }
  // Dedup grosseiro por URL antes da IA + corte para o limite.
  const seen = new Set<string>();
  const unique = articles
    .filter((a) => (seen.has(a.url) ? false : (seen.add(a.url), true)))
    .slice(0, MAX_ARTICLES);

  const { incidents, stats } = await runPipeline(unique);
  return {
    incidents,
    meta: {
      disclaimer:
        "INDÍCIOS extraídos de notícias por IA — não verificados, não são estatística oficial. Cada item traz fonte, link e confiança.",
      official: false,
      stats: { ...stats, provedores: configuredProviderCount() },
      geradoEm: new Date().toISOString(),
    },
  };
}

// Aplica o filtro opcional ?status= (pendente|confirmado|rejeitado). Valor
// invalido e ignorado (devolve tudo). Filtra uma copia — nao muta o cache.
function applyStatusFilter(payload: NewsPayload, status: string | null): NewsPayload {
  if (!status || !REVIEW_STATUSES.includes(status as NewsReviewStatus)) return payload;
  return { ...payload, incidents: payload.incidents.filter((i) => i.reviewStatus === status) };
}

export async function GET(request: Request) {
  if (!aiConfigured()) {
    return NextResponse.json({
      incidents: [],
      meta: { disclaimer: "Camada OSINT desativada: nenhum provedor de IA (AI_*) configurado.", official: false },
    });
  }

  const status = new URL(request.url).searchParams.get("status");

  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(applyStatusFilter(cache.payload, status));
  }

  // Single-flight: se ja existe uma execucao em curso, aguarda-a em vez de
  // disparar uma segunda leva de chamadas de IA (protege a quota diaria).
  if (!inflight) {
    inflight = buildPayload()
      .then((payload) => {
        cache = { at: Date.now(), payload };
        return payload;
      })
      .finally(() => {
        inflight = null;
      });
  }
  const payload = await inflight;
  return NextResponse.json(applyStatusFilter(payload, status));
}
