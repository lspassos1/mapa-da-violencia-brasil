// POST|GET /api/shootings/ingest — job de ingestao do radar de tiroteios (#97).
// Puxa a janela recente da Fogo Cruzado e faz upsert idempotente em
// shooting_occurrences (acumula historico). Protegido por CRON_SECRET. Chamado
// pelo Vercel Cron (GET, diario) ou manual (POST). O GET de /api/shootings
// tambem dispara este fluxo sob demanda quando o store fica defasado.
import { NextResponse } from "next/server";
import { fetchRecentShootings, isFogoCruzadoConfigured } from "@/server/shootings/fogocruzado";
import { isShootingStoreConfigured, upsertShootings } from "@/server/shootings/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // paginar 4 praças da FC pode levar ~30-50s

const DIAS = 7;

// Vercel Cron injeta `Authorization: Bearer <CRON_SECRET>` quando CRON_SECRET
// esta definido. CRON_SECRET e OBRIGATORIO (nao opcional): sem ele o endpoint
// fica permanentemente fechado (401, inclusive ao cron) e a ingestao para — por
// design, p/ nunca expor a ingestao ao publico. Defina-o na Vercel + .env.local.
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isShootingStoreConfigured()) {
    return NextResponse.json(
      { error: "persistencia desativada: defina SUPABASE_SERVICE_ROLE_KEY" },
      { status: 503 },
    );
  }
  if (!isFogoCruzadoConfigured()) {
    return NextResponse.json(
      { error: "fonte desativada: defina FOGO_CRUZADO_EMAIL/PASSWORD" },
      { status: 503 },
    );
  }
  const ocorrencias = await fetchRecentShootings(DIAS);
  const processados = await upsertShootings(ocorrencias);
  return NextResponse.json({ ok: true, processados, puxados: ocorrencias.length, geradoEm: new Date().toISOString() });
}

export const GET = handle; // Vercel Cron usa GET
export const POST = handle; // disparo manual
