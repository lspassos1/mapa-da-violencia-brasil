// GET /api/anomaly-digest — digest semanal do radar de anomalia por IA (#85).
// Cache em memória POR INSTÂNCIA chaveado pela semana ISO + single-flight: dentro
// de uma instância a IA é chamada ~1×/semana; instâncias serverless concorrentes /
// cold starts podem regenerar algumas vezes na semana (inofensivo, IA é grátis).
// Degrada graciosamente sem provedor de IA. Server-only.
import { NextResponse } from "next/server";
import { generateDigest } from "@/server/anomaly/digest";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // a chamada de IA pode levar alguns segundos

// Chave da semana ISO ("YYYY-Www") — o digest é estável dentro da semana.
function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // segunda=0
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // quinta-feira da semana
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / 604800000);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

let cache: { week: string; payload: Record<string, unknown> } | null = null;
let inflight: Promise<Record<string, unknown>> | null = null;

export async function GET() {
  const week = isoWeek(new Date());
  if (cache && cache.week === week) return NextResponse.json(cache.payload);
  if (!inflight) {
    inflight = (async () => {
      const result = await generateDigest();
      if (result) {
        const payload = { ...result, semana: week };
        cache = { week, payload }; // só cacheia sucesso (falha transitória re-tenta)
        return payload;
      }
      return { aviso: "Digest indisponível: nenhum provedor de IA (AI_*) configurado.", semana: week };
    })().finally(() => {
      inflight = null;
    });
  }
  try {
    return NextResponse.json(await inflight);
  } catch {
    return NextResponse.json({ aviso: "Falha ao gerar o digest — tente mais tarde.", semana: week }, { status: 503 });
  }
}
