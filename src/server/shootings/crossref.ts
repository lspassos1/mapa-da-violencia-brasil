// Cross-ref tiroteio↔imprensa (#97) — SERVER-ONLY.
//
// Liga as ocorrencias do radar (Fogo Cruzado, 4 metros) aos incidentes OSINT
// persistidos (noticias extraidas por IA), por MUNICIPIO + janela recente. O
// acervo OSINT e nacional e ainda jovem, entao o overlap com os 4 metros e
// pequeno hoje; cresce com o cron diario de ingestao de noticias. INDICIO, nao
// fato (as noticias ja carregam essa moldura) — aqui so anexamos a referencia.
import "server-only";
import { listIncidents } from "@/server/osint/store";
import { normalizeName } from "@/server/osint/geocode";
import type { NewsIncident } from "@/types/news";
import type { NoticiaRef } from "@/server/shootings/fogocruzado";

// Converte um incidente OSINT na referencia enxuta exposta no radar (fonte
// primaria: titulo do veiculo de maior confianca, link, data, tipo).
function toRef(inc: NewsIncident): NoticiaRef {
  return {
    titulo: inc.fontes[0]?.titulo || inc.resumo || "(sem título)",
    veiculo: inc.veiculo || inc.fontes[0]?.veiculo || "",
    url: inc.fonteUrl || inc.fontes[0]?.fonteUrl || "",
    data: inc.dataOcorrencia,
    tipo: inc.tipo,
  };
}

// Agrupa incidentes por municipio normalizado (puro/testavel). Cada grupo
// ordenado por data desc (mais recente primeiro), limitado a `max` por municipio.
export function groupNoticiasByMunicipio(
  incidents: NewsIncident[],
  max = 5,
): Map<string, NoticiaRef[]> {
  const map = new Map<string, NoticiaRef[]>();
  for (const inc of incidents) {
    if (!inc.municipio) continue;
    const key = normalizeName(inc.municipio);
    (map.get(key) ?? map.set(key, []).get(key)!).push(toRef(inc));
  }
  for (const refs of map.values()) {
    refs.sort((a, b) => (a.data ?? "") < (b.data ?? "") ? 1 : -1);
    if (refs.length > max) refs.splice(max);
  }
  return map;
}

// Ponto OSINT mapeável (notícia de violência armada com geo). Precisão MUNICIPAL
// (centroide IBGE), não exata como a do Fogo Cruzado — sempre rotular como indício.
export interface OsintPoint {
  id: string;
  lat: number;
  lng: number;
  municipio: string;
  uf: string;
  tipo: string;
  titulo: string;
  url: string;
  data: string | null;
  veiculo: string;
}

// Heurística leve "keyword-first" (estilo worldmonitor): é indício de violência
// ARMADA quando o tipo é letal OU o texto traz disparo/arma de fogo. Barato e sem
// LLM. Dois cuidados p/ não confundir esporte/apreensão com violência:
//  (1) "tiro" só conta como "a tiro(s)" — evita "tiro esportivo"/"treina tiro";
//  (2) arma citada só em contexto de APREENSÃO/entrega (sem disparo) não é
//      violência — evita "apreensão de pistola em blitz" (mas mantém "rendeu a
//      vítima com pistola", que É roubo armado).
const DISPARO = /balead|\ba tiros?\b|tiroteio|disparo/i;
const ARMA_FOGO = /arma de fogo|fuzil|pistola|rev[oó]lver|met(ralhad|ralha)/i;
const APREENSAO = /apreens|apreendid|recolhid|entreg/i;
export function ehViolenciaArmada(inc: NewsIncident): boolean {
  if (["homicidio", "latrocinio", "feminicidio"].includes(inc.tipo)) return true;
  const txt = `${inc.resumo} ${inc.fontes[0]?.titulo ?? ""}`;
  if (DISPARO.test(txt)) return true; // houve disparo -> violência armada
  return ARMA_FOGO.test(txt) && !APREENSAO.test(txt); // arma citada, mas não só apreensão
}

function toPoint(inc: NewsIncident): OsintPoint {
  return {
    id: inc.id,
    lat: inc.lat as number,
    lng: inc.lng as number,
    municipio: inc.municipio,
    uf: inc.uf,
    tipo: inc.tipo,
    titulo: inc.fontes[0]?.titulo || inc.resumo || "(sem título)",
    url: inc.fonteUrl || inc.fontes[0]?.fonteUrl || "",
    data: inc.dataOcorrencia,
    veiculo: inc.veiculo || inc.fontes[0]?.veiculo || "",
  };
}

// Carrega o OSINT da janela UMA vez e deriva os dois usos no radar: o agrupamento
// por município (coluna "Imprensa") e os PONTOS NACIONAIS mapeáveis (geo + arma de
// fogo). Vazio quando a persistência OSINT não está configurada — degrada gracioso.
export async function loadOsint(dias: number): Promise<{ porMunicipio: Map<string, NoticiaRef[]>; points: OsintPoint[] }> {
  const incidents = await listIncidents({ dias });
  const porMunicipio = groupNoticiasByMunicipio(incidents);
  const points = incidents.filter((i) => i.lat != null && i.lng != null && ehViolenciaArmada(i)).map(toPoint);
  return { porMunicipio, points };
}
