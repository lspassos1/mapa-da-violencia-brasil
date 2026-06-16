// Ingestao OSINT compartilhada: busca feeds -> dedupe grosso por URL -> pipeline.
// Usada tanto pelo GET ao vivo (sem persistencia) quanto pelo job/cron que
// acumula na tabela news_incidents (#89).
import { fetchRss } from "@/server/osint/rss";
import { runPipeline, type PipelineResult } from "@/server/osint/pipeline";
import { DEFAULT_FEEDS } from "@/server/osint/feeds";
import type { RawArticle } from "@/types/news";

// Teto de artigos por execucao (custo de IA no free tier). Override por env;
// aceita 0/invalido recaindo em 25 (nunca zera a ingestao silenciosamente).
const rawMax =
  process.env.OSINT_MAX_ARTICLES !== undefined ? Number(process.env.OSINT_MAX_ARTICLES) : 25;
export const MAX_ARTICLES = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : 25;

// Roda uma ingestao completa e devolve incidentes deduplicados + stats.
export async function ingestOnce(): Promise<PipelineResult> {
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

  return runPipeline(unique);
}
