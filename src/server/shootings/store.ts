// Persistencia do radar de tiroteios (#97) — SERVER-ONLY, nunca importar no cliente.
//
// Acumula as ocorrencias da Fogo Cruzado na tabela `shooting_occurrences`. A FC so
// serve uma janela movel; persistir da (a) HISTORICO/tendencia alem da janela e
// (b) cache compartilhado entre instancias serverless (cada cold start zera a
// memoria). Chave = id da ocorrencia na FC -> upsert idempotente.
//
// DEGRADACAO GRACIOSA: sem SUPABASE_SERVICE_ROLE_KEY a persistencia fica desligada
// e o GET volta a chamar a FC ao vivo (cache em memoria). Nada quebra.
import "server-only";
import type { ShootingOccurrence } from "@/server/shootings/fogocruzado";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// So persiste quando ha URL + service-role (escrita ignora RLS).
export function isShootingStoreConfigured(): boolean {
  return !!(SUPABASE_URL && SERVICE_ROLE);
}

function headers(): Record<string, string> {
  return {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    "Content-Type": "application/json",
  };
}

function toRow(o: ShootingOccurrence): Record<string, unknown> {
  return {
    id: o.id,
    data: o.data || null,
    estado: o.estado,
    municipio: o.municipio,
    bairro: o.bairro,
    lat: o.lat,
    lng: o.lng,
    main_reason: o.mainReason,
    contexto: o.contexto,
    police_action: o.policeAction,
    mortos: o.mortos,
    feridos: o.feridos,
  };
}

interface Row {
  id: string;
  data: string | null;
  estado: string;
  municipio: string;
  bairro: string | null;
  lat: number | null;
  lng: number | null;
  main_reason: string;
  contexto: ShootingOccurrence["contexto"];
  police_action: boolean;
  mortos: number;
  feridos: number;
}

function fromRow(r: Row): ShootingOccurrence {
  return {
    id: r.id,
    data: r.data ?? "",
    estado: r.estado,
    municipio: r.municipio,
    bairro: r.bairro,
    lat: r.lat,
    lng: r.lng,
    mainReason: r.main_reason,
    contexto: r.contexto,
    policeAction: r.police_action,
    mortos: r.mortos,
    feridos: r.feridos,
  };
}

// Upsert idempotente via RPC. Lanca em erro de rede/HTTP p/ o chamador logar;
// nunca expoe a chave. Ignora ocorrencias sem id (a RPC tambem as pula).
export async function upsertShootings(ocorrencias: ShootingOccurrence[]): Promise<number> {
  if (!isShootingStoreConfigured() || ocorrencias.length === 0) return 0;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/upsert_shooting_occurrences`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ items: ocorrencias.map(toRow) }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`upsert shooting_occurrences HTTP ${res.status}: ${await res.text()}`);
  return (await res.json()) as number;
}

// Le as ocorrencias persistidas dos ultimos `dias` (por data da ocorrencia),
// ordenadas da mais recente p/ a mais antiga. `cap` limita o payload.
export async function listStoredShootings(dias: number, cap = 10000): Promise<ShootingOccurrence[]> {
  if (!isShootingStoreConfigured()) return [];
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  const params = new URLSearchParams({ select: "*", order: "data.desc", limit: String(cap) });
  params.append("data", `gte.${desde}`);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/shooting_occurrences?${params}`, {
    headers: headers(),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`list shooting_occurrences HTTP ${res.status}`);
  return ((await res.json()) as Row[]).map(fromRow);
}

// Instante (ms) da ingestao mais recente, p/ decidir se o store esta fresco.
// null quando vazio. Le so 1 linha (last_seen_at desc).
export async function newestIngestAt(): Promise<number | null> {
  if (!isShootingStoreConfigured()) return null;
  const params = new URLSearchParams({ select: "last_seen_at", order: "last_seen_at.desc", limit: "1" });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/shooting_occurrences?${params}`, {
    headers: headers(),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`newest shooting_occurrences HTTP ${res.status}`);
  const rows = (await res.json()) as { last_seen_at: string }[];
  const ts = rows[0]?.last_seen_at;
  return ts ? new Date(ts).getTime() : null;
}
