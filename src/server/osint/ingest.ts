// Ingestao OSINT compartilhada: busca feeds -> dedupe grosso por URL -> pipeline.
// Usada tanto pelo GET ao vivo (sem persistencia) quanto pelo job/cron que
// acumula na tabela news_incidents (#89).
import { fetchRss } from "@/server/osint/rss";
import { runPipeline, type PipelineResult } from "@/server/osint/pipeline";
import { DEFAULT_FEEDS } from "@/server/osint/feeds";
import { rankByRelevance } from "@/server/osint/keywords";
import { createHybridExtractor } from "@/server/osint/hybridExtractor";
import type { RawArticle } from "@/types/news";

// Teto de chamadas de LLM por execucao (custo de IA no free tier / 60s Hobby).
// Override por env; aceita 0/invalido recaindo em 25.
const rawMax =
  process.env.OSINT_MAX_ARTICLES !== undefined ? Number(process.env.OSINT_MAX_ARTICLES) : 25;
export const MAX_ARTICLES = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : 25;
// Pool processado (keyword-first/dicionario sao baratos). Muito maior que o teto
// de LLM: artigos geocodificados por dicionario nao consomem LLM.
const MAX_POOL = Math.max(MAX_ARTICLES * 6, 60);

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
  // Dedup grosseiro por URL antes da IA.
  const seen = new Set<string>();
  const unique = articles.filter((a) => (seen.has(a.url) ? false : (seen.add(a.url), true)));

  // KEYWORD-FIRST: descarta não-crime e ranqueia por relevância (sem LLM). Passa
  // um POOL grande; o extrator híbrido geocodifica por dicionário (grátis) e só
  // gasta o LLM (até MAX_ARTICLES) no que o dicionário não resolve.
  const ranked = rankByRelevance(unique).slice(0, MAX_POOL);

  return runPipeline(ranked, { extractor: createHybridExtractor(MAX_ARTICLES) });
}
