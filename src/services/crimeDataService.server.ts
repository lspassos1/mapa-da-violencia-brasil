// Loader server-only da carga de dados. Importado APENAS pelas rotas de API
// (server). No modo `official`, le a carga nacional do asset estatico em
// public/officialCrimeData.json via filesystem — assim a carga nacional fica fora
// de qualquer bundle (cliente e servidor) e as rotas permanecem sincronas.
//
// NAO importar este modulo a partir de codigo de cliente: usa node:fs.
// `server-only` faz o Next falhar cedo (build-time) se for importado no cliente.
import "server-only";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { CRIME_DATA_MODE } from "@/lib/dataMode";
import {
  EMPTY_OFFICIAL_DATASET,
  createCrimeDataApi,
  getStaticDataset,
  warnIfEmptyOfficial,
  type CrimeDataApi,
  type OfficialCrimeDataset,
} from "@/services/crimeDataService";

let cachedApi: CrimeDataApi | null = null;

function readOfficialDataset(): OfficialCrimeDataset {
  // A carga e versionada gzipped (.gz). Le e descomprime via filesystem.
  const path = join(process.cwd(), "public", "officialCrimeData.json.gz");
  try {
    return JSON.parse(gunzipSync(readFileSync(path)).toString("utf-8")) as OfficialCrimeDataset;
  } catch (error) {
    if (typeof console !== "undefined") {
      console.warn(
        `[crimeDataService.server] Falha ao ler ${path}: ${String(error)}. A usar placeholder vazio.`,
      );
    }
    return EMPTY_OFFICIAL_DATASET;
  }
}

// API resolvida no servidor: estatica para demo/official_sample; carga lida do
// filesystem para official. Memorizada por processo.
export function getServerCrimeDataApi(): CrimeDataApi {
  if (!cachedApi) {
    // Toda a inicializacao fica protegida: um JSON valido mas estruturalmente
    // inesperado (ex.: indicators ausente) faria createCrimeDataApi lancar, e
    // sem este guard o cachedApi nunca seria atribuido — todas as requisicoes
    // dariam 500 ate reiniciar. Espelha o tratamento do loadCrimeDataApi.
    try {
      if (CRIME_DATA_MODE === "official") {
        const dataset = readOfficialDataset();
        // Em erro de leitura, readOfficialDataset ja avisou e devolveu o placeholder;
        // so avisamos de "vazio" quando a leitura teve sucesso (evita aviso duplo).
        if (dataset !== EMPTY_OFFICIAL_DATASET) {
          warnIfEmptyOfficial(dataset);
        }
        cachedApi = createCrimeDataApi("official", dataset);
      } else {
        cachedApi = createCrimeDataApi(CRIME_DATA_MODE, getStaticDataset(CRIME_DATA_MODE));
      }
    } catch (error) {
      if (typeof console !== "undefined") {
        console.warn(
          `[crimeDataService.server] Falha ao inicializar a API: ${String(error)}. A usar placeholder vazio.`,
        );
      }
      cachedApi = createCrimeDataApi("official", EMPTY_OFFICIAL_DATASET);
    }
  }
  return cachedApi;
}
