// GET /api/shootings — radar de tiroteios (#97).
//
// Arquitetura store-first (spec): le as ocorrencias persistidas em Supabase
// (acumuladas pelo cron /api/shootings/ingest -> historico/tendencia + cache
// compartilhado entre instancias). Quando o store fica DEFASADO (> REFRESH_TTL),
// a primeira requisicao refaz da Fogo Cruzado via single-flight e faz upsert —
// assim a API externa e chamada no maximo ~1×/REFRESH_TTL, respeitando o limite,
// e o radar segue near-real-time mesmo com o cron diario do plano Hobby.
//
// DEGRADACAO GRACIOSA: sem Supabase, cai no modo AO VIVO (cache em memoria +
// single-flight, comportamento original). Sem FC nem store, responde desativado.
import { NextResponse } from "next/server";
import {
  aggregateByMunicipio,
  aggregateDaily,
  fetchRecentShootings,
  isFogoCruzadoConfigured,
  type DiaResumo,
  type MunicipioResumoLente2,
  type ShootingOccurrence,
} from "@/server/shootings/fogocruzado";
import {
  isShootingStoreConfigured,
  listStoredShootings,
  newestIngestAt,
  upsertShootings,
} from "@/server/shootings/store";
import { getRjCriminalGovernance } from "@/server/anomaly/criminalGovernance";
import { normalizeName } from "@/server/osint/geocode";

export const dynamic = "force-dynamic";

const DIAS = 7; // janela do mapa/lista
const HIST_DIAS = 30; // janela da tendencia historica
const REFRESH_TTL_MS = 30 * 60 * 1000; // store mais velho que isto -> refaz da FC
const LIVE_TTL_MS = 15 * 60 * 1000; // cache do modo ao vivo (sem store)
const STORE_CACHE_MS = 60 * 1000; // cache em memoria do payload montado do store
const ERROR_BACKOFF_MS = 60 * 1000; // em falha, nao martela a API externa
const DISCLAIMER =
  "Registros de tiroteios/disparos por arma de fogo (fonte: Fogo Cruzado). NÃO é alerta de emergência nem estatística oficial — use 190 em urgências.";
const COBERTURA =
  "Regiões metropolitanas de Rio de Janeiro, Recife, Salvador e Belém (57 municípios — onde o Fogo Cruzado atua; não é nacional)";

interface Payload {
  ocorrencias: ShootingOccurrence[];
  meta: Record<string, unknown>;
}

// Monta o payload (puro): contexto, mortos, por-municipio com overlay da lente 2
// (controle×disputa, so RJ) e a serie diaria historica.
function assemble(ocorrencias: ShootingOccurrence[], fonte: string, historico: DiaResumo[]): Payload {
  const porContexto = { disputa: 0, policia: 0, outro: 0 };
  let mortos = 0;
  for (const o of ocorrencias) {
    porContexto[o.contexto]++;
    mortos += o.mortos;
  }
  const lente2 = new Map<string, "controle" | "disputa" | "misto">();
  for (const g of getRjCriminalGovernance()) lente2.set(normalizeName(g.municipio), g.classificacao);
  const porMunicipio: MunicipioResumoLente2[] = aggregateByMunicipio(ocorrencias).map((m) => ({
    ...m,
    lente2: normalizeName(m.estado) === "rio de janeiro" ? lente2.get(normalizeName(m.municipio)) ?? null : null,
  }));
  return {
    ocorrencias,
    meta: {
      fonte,
      cobertura: COBERTURA,
      dias: DIAS,
      disclaimer: DISCLAIMER,
      total: ocorrencias.length,
      porContexto,
      porMunicipio,
      mortos,
      historico,
      geradoEm: new Date().toISOString(),
    },
  };
}

function withinDays(dataIso: string, dias: number): boolean {
  const t = Date.parse(dataIso);
  return Number.isFinite(t) && t >= Date.now() - dias * 86_400_000;
}

let lastErrorAt = 0;

// ---- Modo STORE (preferido) ------------------------------------------------
let storeCache: { at: number; payload: Payload } | null = null;
let refreshing: Promise<void> | null = null;

// Refaz a janela da FC e faz upsert (single-flight: 1 chamada externa concorrente).
function refreshFromFC(): Promise<void> {
  if (!refreshing) {
    refreshing = (async () => {
      const occ = await fetchRecentShootings(DIAS);
      await upsertShootings(occ);
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

async function servedFromStore(fcOn: boolean): Promise<Payload> {
  const now = Date.now();
  if (storeCache && now - storeCache.at < STORE_CACHE_MS) return storeCache.payload;

  const newest = await newestIngestAt();
  const stale = newest === null || now - newest > REFRESH_TTL_MS;
  let fonte = "Supabase (persistido)";
  if (stale && fcOn && now - lastErrorAt >= ERROR_BACKOFF_MS) {
    try {
      await refreshFromFC();
      fonte = "Supabase (atualizado near-real-time)";
    } catch {
      lastErrorAt = Date.now();
      fonte = newest ? "Supabase (defasado — fonte instável)" : fonte;
    }
  } else if (stale) {
    fonte = "Supabase (defasado)";
  }

  const janela = await listStoredShootings(HIST_DIAS);
  const recentes = janela.filter((o) => withinDays(o.data, DIAS));
  const payload = assemble(recentes, fonte, aggregateDaily(janela));
  storeCache = { at: Date.now(), payload };
  return payload;
}

// ---- Modo AO VIVO (sem store) ---------------------------------------------
let liveCache: { at: number; payload: Payload } | null = null;
let liveInflight: Promise<Payload> | null = null;

async function buildLive(): Promise<Payload> {
  const occ = await fetchRecentShootings(DIAS);
  return assemble(occ, "Fogo Cruzado (ao vivo)", aggregateDaily(occ));
}

async function servedLive(): Promise<Payload> {
  const now = Date.now();
  if (liveCache && now - liveCache.at < LIVE_TTL_MS) return liveCache.payload;
  if (now - lastErrorAt < ERROR_BACKOFF_MS) {
    if (liveCache) return liveCache.payload;
    throw new Error("backoff");
  }
  if (!liveInflight) {
    liveInflight = buildLive()
      .then((payload) => {
        liveCache = { at: Date.now(), payload };
        return payload;
      })
      .catch((e) => {
        lastErrorAt = Date.now();
        throw e;
      })
      .finally(() => {
        liveInflight = null;
      });
  }
  return liveInflight;
}

export async function GET() {
  const fcOn = isFogoCruzadoConfigured();
  const storeOn = isShootingStoreConfigured();
  if (!fcOn && !storeOn) {
    return NextResponse.json({
      ocorrencias: [],
      meta: { fonte: "Fogo Cruzado", aviso: "Radar desativado: credenciais FOGO_CRUZADO_* / Supabase ausentes.", disclaimer: DISCLAIMER, dias: DIAS },
    });
  }

  if (storeOn) {
    try {
      return NextResponse.json(await servedFromStore(fcOn));
    } catch {
      // store indisponivel -> tenta ao vivo (se FC), senao 503
    }
  }
  if (fcOn) {
    try {
      return NextResponse.json(await servedLive());
    } catch {
      if (liveCache) return NextResponse.json(liveCache.payload); // fallback stale
    }
  }
  return NextResponse.json(indisponivel(), { status: 503 });
}

function indisponivel(): Payload {
  return { ocorrencias: [], meta: { fonte: "Fogo Cruzado", disclaimer: DISCLAIMER, dias: DIAS, aviso: "Fonte temporariamente indisponível — tente em instantes." } };
}
