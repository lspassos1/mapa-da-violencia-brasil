// POST /api/news-incidents/review — fila de revisao humana (#89).
// Aprova/rejeita um incidente por incident_key. Grava reviewed_by/reviewed_at p/
// que a reingestao NAO sobrescreva a decisao (ver RPC upsert_news_incidents).
// Protegido por CRON_SECRET (token de admin) — nunca exposto na UI publica.
import { NextResponse } from "next/server";
import { isPersistenceConfigured, setReview } from "@/server/osint/store";
import type { NewsReviewStatus } from "@/types/news";

export const dynamic = "force-dynamic";

const STATUSES: readonly NewsReviewStatus[] = ["pendente", "confirmado", "rejeitado"];

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isPersistenceConfigured()) {
    return NextResponse.json({ error: "persistencia desativada" }, { status: 503 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "json invalido" }, { status: 400 });
  }
  const key = body.key;
  const status = body.status;
  const reviewedBy = body.reviewedBy;
  if (typeof key !== "string" || typeof status !== "string" || !STATUSES.includes(status as NewsReviewStatus)) {
    return NextResponse.json({ error: "key/status invalidos" }, { status: 400 });
  }
  const quem = typeof reviewedBy === "string" && reviewedBy ? reviewedBy : "admin";
  const ok = await setReview(key, status as NewsReviewStatus, quem);
  return NextResponse.json({ ok }, { status: ok ? 200 : 500 });
}
