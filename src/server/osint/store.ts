// Persistencia da camada OSINT (#89) — SERVER-ONLY, nunca importar no cliente.
//
// Acumula incidentes entre execucoes na tabela `news_incidents` (Supabase),
// permitindo: (a) nowcast de uma semana inteira (base p/ o radar #85), (b) fila
// de revisao humana que sobrevive a reinicios, (c) GET sem disparar IA.
//
// DEGRADACAO GRACIOSA: sem SUPABASE_SERVICE_ROLE_KEY a persistencia fica
// desligada e o pipeline volta a ser stateless (comportamento atual). Nada quebra.
import "server-only";
import type { NewsIncident, NewsReviewStatus } from "@/types/news";
import { normalizeName } from "@/server/osint/geocode";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// So persiste quando ha URL + service-role (escrita ignora RLS). Caso contrario
// o chamador recai no pipeline ao vivo.
export function isPersistenceConfigured(): boolean {
  return !!(SUPABASE_URL && SERVICE_ROLE);
}

// Identidade SEMANTICA p/ upsert idempotente entre execucoes (estavel ao longo da
// semana, ao contrario do id efemero que depende da composicao de fontes da run).
export function incidentKey(inc: NewsIncident): string {
  return inc.idIbge
    ? `${inc.tipo}|${inc.uf}|${normalizeName(inc.municipio)}|${inc.dataOcorrencia ?? "?"}`
    : `ungeo|${inc.tipo}|${normalizeName(inc.fontes[0]?.titulo ?? inc.resumo)}`;
}

function headers(): Record<string, string> {
  return {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    "Content-Type": "application/json",
  };
}

function toRow(inc: NewsIncident): Record<string, unknown> {
  return {
    incident_key: incidentKey(inc),
    tipo: inc.tipo,
    municipio: inc.municipio,
    uf: inc.uf,
    id_ibge: inc.idIbge,
    lat: inc.lat,
    lng: inc.lng,
    vitimas: inc.vitimas,
    data_ocorrencia: inc.dataOcorrencia,
    resumo: inc.resumo,
    confianca: inc.confianca,
    corroboracao: inc.corroboracao,
    fontes: inc.fontes,
    veiculo: inc.veiculo,
    fonte_url: inc.fonteUrl,
    provedor: inc.provedor,
    review_status: inc.reviewStatus,
  };
}

interface Row {
  incident_key: string;
  tipo: NewsIncident["tipo"];
  municipio: string;
  uf: string;
  id_ibge: string | null;
  lat: number | null;
  lng: number | null;
  vitimas: number | null;
  data_ocorrencia: string | null;
  resumo: string;
  confianca: number | string;
  corroboracao: number;
  fontes: NewsIncident["fontes"];
  veiculo: string;
  fonte_url: string;
  provedor: string;
  review_status: NewsReviewStatus;
  last_seen_at: string;
}

function fromRow(r: Row): NewsIncident {
  return {
    id: r.incident_key, // chave semantica estavel serve de id na UI
    tipo: r.tipo,
    municipio: r.municipio,
    uf: r.uf,
    idIbge: r.id_ibge,
    lat: r.lat,
    lng: r.lng,
    vitimas: r.vitimas,
    dataOcorrencia: r.data_ocorrencia,
    resumo: r.resumo,
    fontes: r.fontes ?? [],
    corroboracao: r.corroboracao,
    fonteUrl: r.fonte_url,
    veiculo: r.veiculo,
    provedor: r.provedor,
    confianca: Number(r.confianca),
    reviewStatus: r.review_status,
    extraidoEm: r.last_seen_at,
  };
}

// Upsert idempotente via RPC (preserva decisao humana e first_seen_at no servidor).
// Lanca em erro de rede/HTTP p/ o chamador logar; nunca expoe a chave.
export async function upsertIncidents(incidents: NewsIncident[]): Promise<number> {
  if (!isPersistenceConfigured() || incidents.length === 0) return 0;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/upsert_news_incidents`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ items: incidents.map(toRow) }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`upsert news_incidents HTTP ${res.status}: ${await res.text()}`);
  return (await res.json()) as number;
}

// Le incidentes persistidos (default: dos ultimos `dias`, exceto rejeitados),
// ordenados por confianca desc. `status` filtra por estado de revisao.
export async function listIncidents(
  opts: { status?: NewsReviewStatus; dias?: number } = {},
): Promise<NewsIncident[]> {
  if (!isPersistenceConfigured()) return [];
  const dias = opts.dias ?? 7;
  const params = new URLSearchParams({ select: "*", order: "confianca.desc" });
  if (opts.status) params.set("review_status", `eq.${opts.status}`);
  else params.set("review_status", "neq.rejeitado");
  // Janela: visto nos ultimos N dias (acumulacao do nowcast).
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  params.append("last_seen_at", `gte.${desde}`);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/news_incidents?${params}`, {
    headers: headers(),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`list news_incidents HTTP ${res.status}`);
  return ((await res.json()) as Row[]).map(fromRow);
}

// Marca revisao humana (aprovar/rejeitar). Grava reviewed_by/reviewed_at p/ que a
// reingestao nao sobrescreva a decisao (ver RPC upsert_news_incidents).
export async function setReview(
  key: string,
  status: NewsReviewStatus,
  reviewedBy: string,
): Promise<boolean> {
  if (!isPersistenceConfigured()) return false;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/news_incidents?incident_key=eq.${encodeURIComponent(key)}`,
    {
      method: "PATCH",
      // count=exact -> Content-Range traz o total afetado, p/ distinguir
      // "atualizou" de "0 linhas" (chave inexistente/typo) — que o PostgREST
      // tambem responde 204. Sem isso, uma revisao a uma chave errada "sucederia".
      headers: { ...headers(), Prefer: "return=minimal,count=exact" },
      body: JSON.stringify({ review_status: status, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!res.ok) return false;
  const total = res.headers.get("content-range")?.split("/")[1];
  return total != null && total !== "0" && total !== "*";
}
