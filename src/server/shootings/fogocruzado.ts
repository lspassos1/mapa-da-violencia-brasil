// Cliente Fogo Cruzado (API v2) — SERVER-ONLY. Base do radar de tiroteios
// georreferenciados (#97). Puxa a JANELA RECENTE de ocorrências; o GET cacheia
// (single-flight) para chamar a API no máx. 1×/janela, respeitando o limite.
//
// Cobertura = a do Fogo Cruzado: RJ, Recife, Bahia, Pará.
import "server-only";

const API = "https://api-service.fogocruzado.org.br/api/v2";
const EMAIL = process.env.FOGO_CRUZADO_EMAIL ?? "";
const PASSWORD = process.env.FOGO_CRUZADO_PASSWORD ?? "";

export function isFogoCruzadoConfigured(): boolean {
  return !!(EMAIL && PASSWORD);
}

export type Contexto = "disputa" | "policia" | "outro";

// Classifica o contexto do tiroteio a partir do motivo + ação policial.
// "disputa" = guerra entre grupos armados; "policia" = operação/ação policial.
export function classifyContexto(mainReason: string | null | undefined, policeAction: boolean): Contexto {
  const r = (mainReason ?? "").toLowerCase();
  if (r.includes("disputa")) return "disputa";
  if (policeAction || r.includes("policial")) return "policia";
  return "outro";
}

export interface ShootingOccurrence {
  id: string;
  data: string; // ISO
  estado: string;
  municipio: string;
  bairro: string | null;
  lat: number | null;
  lng: number | null;
  mainReason: string;
  contexto: Contexto;
  policeAction: boolean;
  mortos: number;
  feridos: number;
}

// Mapeia o registro cru da API para a forma enxuta exposta ao cliente (pura/testável).
export function mapOccurrence(r: Record<string, unknown>): ShootingOccurrence {
  const get = (o: unknown, k: string) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined);
  const ctx = get(r, "contextInfo");
  const mainReason = String(get(get(ctx, "mainReason"), "name") ?? "");
  const policeAction = Boolean(r.policeAction);
  const victims = Array.isArray(r.victims) ? (r.victims as Record<string, unknown>[]) : [];
  let mortos = 0;
  let feridos = 0;
  for (const v of victims) {
    if (v.type !== "People") continue;
    if (v.situation === "Dead") mortos++;
    else if (v.situation === "Wounded") feridos++;
  }
  // Number("")===0 e Number(null)===0 — trata vazio/ausente como null (não 0).
  const num = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    id: String(r.id ?? ""),
    data: String(r.date ?? ""),
    estado: String(get(get(r, "state"), "name") ?? ""),
    municipio: String(get(get(r, "city"), "name") ?? ""),
    bairro: (get(get(r, "neighborhood"), "name") as string) ?? null,
    lat: num(r.latitude),
    lng: num(r.longitude),
    mainReason,
    contexto: classifyContexto(mainReason, policeAction),
    policeAction,
    mortos,
    feridos,
  };
}

async function login(): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Fogo Cruzado login HTTP ${res.status}`);
  const token = (await res.json())?.data?.accessToken;
  if (!token) throw new Error("Fogo Cruzado login sem token");
  return token;
}

// Ocorrências dos últimos `dias` em todas as praças cobertas (RJ/Recife/BA/PA).
export async function fetchRecentShootings(dias = 7): Promise<ShootingOccurrence[]> {
  if (!isFogoCruzadoConfigured()) return [];
  const token = await login();
  const headers = { Authorization: `Bearer ${token}` };

  const statesRes = await fetch(`${API}/states`, { headers, signal: AbortSignal.timeout(20000) });
  if (!statesRes.ok) throw new Error(`Fogo Cruzado states HTTP ${statesRes.status}`);
  const states = (((await statesRes.json())?.data ?? []) as Record<string, unknown>[]).filter((s) => s.id);

  const hoje = new Date();
  const inicio = new Date(Date.now() - dias * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const out: ShootingOccurrence[] = [];
  for (const st of states) {
    for (let page = 1; ; page++) {
      const url = `${API}/occurrences?idState=${st.id}&initialdate=${fmt(inicio)}&finaldate=${fmt(hoje)}&take=1000&page=${page}`;
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
      if (!res.ok) break;
      const json = await res.json();
      for (const r of (json.data ?? []) as Record<string, unknown>[]) out.push(mapOccurrence(r));
      if (!json.pageMeta?.hasNextPage) break;
    }
  }
  return out;
}
