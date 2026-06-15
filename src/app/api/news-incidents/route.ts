// GET /api/news-incidents — camada OSINT (indicios de noticias, NAO base oficial).
// Com persistencia (#89) ligada: le os incidentes ACUMULADOS na tabela
// news_incidents (sem disparar IA no hot path). Sem persistencia: roda o pipeline
// ao vivo (feeds RSS -> IA -> geocoding -> dedupe) com cache em memoria +
// single-flight. Server-only; chaves nunca expostas ao cliente.
import { NextResponse } from "next/server";
import { ingestOnce } from "@/server/osint/ingest";
import { configuredProviderCount } from "@/server/osint/providers";
import { isPersistenceConfigured, listIncidents, upsertIncidents } from "@/server/osint/store";
import type { NewsIncident, NewsReviewStatus } from "@/types/news";

export const dynamic = "force-dynamic";

const TTL_MS = 10 * 60 * 1000; // 10 min
const WINDOW_DAYS = 7; // janela de acumulacao do nowcast (leitura persistida)
const DISCLAIMER =
  "INDÍCIOS extraídos de notícias por IA — não verificados, não são estatística oficial. Cada item traz fonte, link e confiança.";

interface NewsPayload {
  incidents: NewsIncident[];
  meta: Record<string, unknown>;
}

let cache: { at: number; payload: NewsPayload } | null = null;
let inflight: Promise<NewsPayload> | null = null;

// Estados expostos no endpoint PUBLICO. `rejeitado` NUNCA — sao incidentes que
// um humano excluiu da vista publica; o GET le via service-role (ignora RLS),
// entao filtrar aqui e o que impede o vazamento via ?status=rejeitado.
const PUBLIC_STATUSES: readonly NewsReviewStatus[] = ["pendente", "confirmado"];

function aiConfigured(): boolean {
  return configuredProviderCount() > 0;
}

// Payload a partir do pipeline ao vivo (com stats de ingestao completas).
async function buildLivePayload(): Promise<NewsPayload> {
  const { incidents, stats } = await ingestOnce();
  return {
    incidents,
    meta: {
      disclaimer: DISCLAIMER,
      official: false,
      fonte: "ao-vivo",
      stats: { ...stats, provedores: configuredProviderCount() },
      geradoEm: new Date().toISOString(),
    },
  };
}

// Payload a partir do banco (incidentes acumulados; stats focadas no conjunto).
async function buildStoredPayload(status: NewsReviewStatus | null): Promise<NewsPayload> {
  const incidents = await listIncidents({ status: status ?? undefined, dias: WINDOW_DAYS });
  return {
    incidents,
    meta: {
      disclaimer: DISCLAIMER,
      official: false,
      fonte: "persistido",
      janelaDias: WINDOW_DAYS,
      stats: {
        total: incidents.length,
        incidentesMultiFonte: incidents.filter((i) => i.corroboracao > 1).length,
        provedores: configuredProviderCount(),
      },
      geradoEm: new Date().toISOString(),
    },
  };
}

// Aplica o filtro opcional ?status= (pendente|confirmado|rejeitado). Valor
// invalido e ignorado. Filtra uma copia — nao muta o cache.
function applyStatusFilter(payload: NewsPayload, status: NewsReviewStatus | null): NewsPayload {
  if (!status) return payload;
  return { ...payload, incidents: payload.incidents.filter((i) => i.reviewStatus === status) };
}

function parseStatus(request: Request): NewsReviewStatus | null {
  const raw = new URL(request.url).searchParams.get("status");
  return raw && PUBLIC_STATUSES.includes(raw as NewsReviewStatus) ? (raw as NewsReviewStatus) : null;
}

// Pipeline ao vivo com cache em memoria + single-flight (protege a quota diaria).
async function liveCachedPayload(): Promise<NewsPayload> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.payload;
  if (!inflight) {
    inflight = buildLivePayload()
      .then((payload) => {
        cache = { at: Date.now(), payload };
        return payload;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export async function GET(request: Request) {
  const status = parseStatus(request);

  // Caminho persistido: le o acumulado do banco (sem IA no hot path). Uma falha
  // do Supabase NAO pode derrubar a aba — cai para o pipeline ao vivo (degradacao).
  if (isPersistenceConfigured()) {
    try {
      const stored = await buildStoredPayload(status);
      // So retorna o persistido se houver dados (ou filtro explicito). Tabela fria
      // com IA disponivel: cai para o caminho ao vivo abaixo (que tambem aquece).
      if (stored.incidents.length > 0 || status || !aiConfigured()) {
        return NextResponse.json(stored);
      }
    } catch (err) {
      console.warn(`[news-incidents] leitura persistida falhou; fallback ao vivo: ${String(err)}`);
      // segue para o caminho ao vivo
    }
  }

  // Caminho ao vivo (sem persistencia, tabela fria, ou falha no banco).
  if (!aiConfigured()) {
    return NextResponse.json({
      incidents: [],
      meta: { disclaimer: "Camada OSINT desativada: nenhum provedor de IA (AI_*) configurado.", official: false },
    });
  }
  const payload = await liveCachedPayload();
  // Se persistido (tabela fria/erro transitorio), aquece o banco com o que veio.
  if (isPersistenceConfigured()) void upsertIncidents(payload.incidents).catch(() => {});
  return NextResponse.json(applyStatusFilter(payload, status));
}
