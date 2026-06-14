// GET /api/news-incidents — camada OSINT (indicios de noticias, NAO base oficial).
// Pipeline: feeds RSS -> extracao por IA (rodizio AI_*) -> geocoding -> dedupe.
// Server-only; chaves nunca expostas ao cliente. Cache em memoria + single-flight
// (chamadas concorrentes a frio aguardam a MESMA execucao, sem multiplicar custo).
import { NextResponse } from "next/server";
import { fetchRss } from "@/server/osint/rss";
import { runPipeline } from "@/server/osint/pipeline";
import { configuredProviderCount } from "@/server/osint/providers";
import { DEFAULT_FEEDS } from "@/server/osint/feeds";
import type { RawArticle } from "@/types/news";

export const dynamic = "force-dynamic";

const MAX_ARTICLES = 15; // limita custo/latencia no free tier
const TTL_MS = 10 * 60 * 1000; // 10 min

let cache: { at: number; payload: unknown } | null = null;
let inflight: Promise<unknown> | null = null;

function aiConfigured(): boolean {
  return configuredProviderCount() > 0;
}

async function buildPayload() {
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

export async function GET() {
  if (!aiConfigured()) {
    return NextResponse.json({
      incidents: [],
      meta: { disclaimer: "Camada OSINT desativada: nenhum provedor de IA (AI_*) configurado.", official: false },
    });
  }

  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.payload);
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
  return NextResponse.json(payload);
}
