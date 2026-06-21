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

// Le os incidentes OSINT persistidos da janela e agrupa por municipio. Vazio
// (Map vazio) quando a persistencia OSINT nao esta configurada — degrada gracioso.
export async function noticiasPorMunicipio(dias: number): Promise<Map<string, NoticiaRef[]>> {
  const incidents = await listIncidents({ dias });
  return groupNoticiasByMunicipio(incidents);
}
