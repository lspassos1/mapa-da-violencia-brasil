// POST|GET /api/news-incidents/ingest — job de ingestao OSINT (#89).
// Roda o pipeline e faz upsert idempotente na tabela news_incidents (acumula o
// nowcast). Protegido por CRON_SECRET. Chamado pelo Vercel Cron (GET) ou manual.
import { NextResponse } from "next/server";
import { ingestOnce } from "@/server/osint/ingest";
import { isPersistenceConfigured, upsertIncidents } from "@/server/osint/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // o pipeline (RSS + IA) pode levar ~30-60s

// Vercel Cron injeta `Authorization: Bearer <CRON_SECRET>` quando CRON_SECRET
// esta definido. Sem o segredo, o endpoint fica fechado (nunca aberto ao publico).
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isPersistenceConfigured()) {
    return NextResponse.json(
      { error: "persistencia desativada: defina SUPABASE_SERVICE_ROLE_KEY" },
      { status: 503 },
    );
  }
  const { incidents, stats } = await ingestOnce();
  const upserted = await upsertIncidents(incidents);
  return NextResponse.json({ ok: true, upserted, stats, geradoEm: new Date().toISOString() });
}

export const GET = handle; // Vercel Cron usa GET
export const POST = handle; // disparo manual
