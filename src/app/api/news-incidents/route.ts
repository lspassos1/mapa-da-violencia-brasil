// GET /api/news-incidents — camada OSINT (indicios de noticias, NAO base oficial).
// Pipeline: feeds RSS -> extracao por IA (AI_*) -> geocoding -> dedupe.
// Server-only; chaves nunca expostas ao cliente. Cache em memoria com TTL curto.
import { NextResponse } from "next/server";
import { fetchRss } from "@/server/osint/rss";
import { runPipeline } from "@/server/osint/pipeline";
import { DEFAULT_FEEDS } from "@/server/osint/feeds";
import type { RawArticle } from "@/types/news";

export const dynamic = "force-dynamic";

const MAX_ARTICLES = 15; // limita custo/latencia no free tier
const TTL_MS = 10 * 60 * 1000; // 10 min

let cache: { at: number; payload: unknown } | null = null;

function aiConfigured(): boolean {
  return Boolean(
    process.env.AI_GEMINI_API_KEY || process.env.AI_GROQ_API_KEY || process.env.AI_OPENROUTER_API_KEY,
  );
}

export async function GET() {
  // Sem provedor de IA configurado: responde vazio com aviso (nao quebra build/preview).
  if (!aiConfigured()) {
    return NextResponse.json({
      incidents: [],
      meta: {
        disclaimer: "Camada OSINT desativada: nenhum provedor de IA (AI_*) configurado.",
        official: false,
      },
    });
  }

  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.payload);
  }

  // Coleta artigos de todos os feeds (tolerante a falha de um feed).
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
  const unique = articles.filter((a) => (seen.has(a.url) ? false : (seen.add(a.url), true))).slice(0, MAX_ARTICLES);

  const { incidents, stats } = await runPipeline(unique);

  const payload = {
    incidents,
    meta: {
      disclaimer:
        "INDÍCIOS extraídos de notícias por IA — não verificados, não são estatística oficial. Cada item traz fonte, link e confiança.",
      official: false,
      stats,
      geradoEm: new Date().toISOString(),
    },
  };
  cache = { at: Date.now(), payload };
  return NextResponse.json(payload);
}
