// GET /api/shootings — radar de tiroteios (#97). Lê a janela recente do Fogo
// Cruzado com cache em memória + single-flight: a API externa é chamada no máx.
// 1×/TTL, compartilhada por todos os usuários (respeita o limite). Server-only.
import { NextResponse } from "next/server";
import { fetchRecentShootings, isFogoCruzadoConfigured, type ShootingOccurrence } from "@/server/shootings/fogocruzado";

export const dynamic = "force-dynamic";

const DIAS = 7;
const TTL_MS = 15 * 60 * 1000; // janela de atualização (protege o limite da API)
const DISCLAIMER =
  "Registros de tiroteios/disparos por arma de fogo (fonte: Fogo Cruzado). NÃO é alerta de emergência nem estatística oficial — use 190 em urgências.";

interface Payload {
  ocorrencias: ShootingOccurrence[];
  meta: Record<string, unknown>;
}

let cache: { at: number; payload: Payload } | null = null;
let inflight: Promise<Payload> | null = null;

async function build(): Promise<Payload> {
  const ocorrencias = await fetchRecentShootings(DIAS);
  const porContexto = { disputa: 0, policia: 0, outro: 0 };
  let mortos = 0;
  for (const o of ocorrencias) {
    porContexto[o.contexto]++;
    mortos += o.mortos;
  }
  return {
    ocorrencias,
    meta: {
      fonte: "Fogo Cruzado (API v2)",
      cobertura: "RJ, Recife, Bahia, Pará",
      dias: DIAS,
      disclaimer: DISCLAIMER,
      total: ocorrencias.length,
      porContexto,
      mortos,
      geradoEm: new Date().toISOString(),
    },
  };
}

export async function GET() {
  if (!isFogoCruzadoConfigured()) {
    return NextResponse.json({
      ocorrencias: [],
      meta: { fonte: "Fogo Cruzado", aviso: "Radar desativado: credenciais FOGO_CRUZADO_* ausentes.", disclaimer: DISCLAIMER, dias: DIAS },
    });
  }
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.payload);
  }
  if (!inflight) {
    inflight = build()
      .then((payload) => {
        cache = { at: Date.now(), payload };
        return payload;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return NextResponse.json(await inflight);
}
