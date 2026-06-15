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

const REVIEW_STATUSES: readonly NewsReviewStatus[] = ["pendente", "confirmado", "rejeitado"];

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
  return raw && REVIEW_STATUSES.includes(raw as NewsReviewStatus) ? (raw as NewsReviewStatus) : null;
}

export async function GET(request: Request) {
  const status = parseStatus(request);

  // Caminho persistido: le o acumulado do banco (sem IA no hot path).
  if (isPersistenceConfigured()) {
    const stored = await buildStoredPayload(status);
    // Tabela ainda fria e ha IA: aquece ao vivo e faz upsert (nao bloqueia a resposta).
    if (stored.incidents.length === 0 && !status && aiConfigured()) {
      const live = await buildLivePayload();
      void upsertIncidents(live.incidents).catch(() => {});
      return NextResponse.json(live);
    }
    return NextResponse.json(stored);
  }

  // Sem persistencia: pipeline ao vivo com cache + single-flight (protege a quota).
  if (!aiConfigured()) {
    return NextResponse.json({
      incidents: [],
      meta: { disclaimer: "Camada OSINT desativada: nenhum provedor de IA (AI_*) configurado.", official: false },
    });
  }
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(applyStatusFilter(cache.payload, status));
  }
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
  const payload = await inflight;
  return NextResponse.json(applyStatusFilter(payload, status));
}
