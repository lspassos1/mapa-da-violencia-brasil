// GET /api/shootings — radar de tiroteios (#97). Lê a janela recente do Fogo
// Cruzado com cache em memória + single-flight: a API externa é chamada no máx.
// 1×/TTL, compartilhada por todos os usuários (respeita o limite). Server-only.
import { NextResponse } from "next/server";
import { aggregateByMunicipio, fetchRecentShootings, isFogoCruzadoConfigured, type MunicipioResumoLente2, type ShootingOccurrence } from "@/server/shootings/fogocruzado";
import { getRjCriminalGovernance } from "@/server/anomaly/criminalGovernance";
import { normalizeName } from "@/server/osint/geocode";

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
let lastErrorAt = 0;
const ERROR_BACKOFF_MS = 60 * 1000; // em falha, não martela a API externa

async function build(): Promise<Payload> {
  const ocorrencias = await fetchRecentShootings(DIAS);
  const porContexto = { disputa: 0, policia: 0, outro: 0 };
  let mortos = 0;
  for (const o of ocorrencias) {
    porContexto[o.contexto]++;
    mortos += o.mortos;
  }

  // Overlay da lente 2 (controle×disputa) nos municípios do RJ que a têm.
  const lente2 = new Map<string, "controle" | "disputa" | "misto">();
  for (const g of getRjCriminalGovernance()) lente2.set(normalizeName(g.municipio), g.classificacao);
  const porMunicipio: MunicipioResumoLente2[] = aggregateByMunicipio(ocorrencias).map((m) => ({
    ...m,
    lente2: normalizeName(m.estado) === "rio de janeiro" ? lente2.get(normalizeName(m.municipio)) ?? null : null,
  }));

  return {
    ocorrencias,
    meta: {
      fonte: "Fogo Cruzado (API v2)",
      cobertura: "Regiões metropolitanas de Rio de Janeiro, Recife, Salvador e Belém (57 municípios — onde o Fogo Cruzado atua; não é nacional)",
      dias: DIAS,
      disclaimer: DISCLAIMER,
      total: ocorrencias.length,
      porContexto,
      porMunicipio,
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
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) {
    return NextResponse.json(cache.payload);
  }
  // Backoff: após uma falha, não refaz a chamada externa por ERROR_BACKOFF_MS —
  // serve cache stale se houver, senão 503. (single-flight só cobre concorrentes.)
  if (now - lastErrorAt < ERROR_BACKOFF_MS) {
    if (cache) return NextResponse.json(cache.payload);
    return NextResponse.json(indisponivel(), { status: 503 });
  }
  if (!inflight) {
    inflight = build()
      .then((payload) => {
        cache = { at: Date.now(), payload };
        return payload;
      })
      .catch((e) => {
        lastErrorAt = Date.now();
        throw e;
      })
      .finally(() => {
        inflight = null;
      });
  }
  try {
    return NextResponse.json(await inflight);
  } catch {
    if (cache) return NextResponse.json(cache.payload); // fallback stale
    return NextResponse.json(indisponivel(), { status: 503 });
  }
}

function indisponivel(): Payload {
  return { ocorrencias: [], meta: { fonte: "Fogo Cruzado", disclaimer: DISCLAIMER, dias: DIAS, aviso: "Fonte temporariamente indisponível — tente em instantes." } };
}
