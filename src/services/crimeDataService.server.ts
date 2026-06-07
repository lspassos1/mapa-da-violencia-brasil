// Loader server-only da carga de dados. Importado APENAS pelas rotas de API
// (server). Em `official` le o asset estatico do filesystem; em `supabase`
// busca-o do Supabase Storage. Em ambos os casos a carga fica fora dos bundles.
//
// NAO importar este modulo a partir de codigo de cliente: usa node:fs.
// `server-only` faz o Next falhar cedo (build-time) se for importado no cliente.
import "server-only";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { CRIME_DATA_MODE, isRemoteDataMode } from "@/lib/dataMode";
import {
  EMPTY_OFFICIAL_DATASET,
  SUPABASE_DATASET_URL,
  createCrimeDataApi,
  getStaticDataset,
  warnIfEmptyOfficial,
  type CrimeDataApi,
  type OfficialCrimeDataset,
} from "@/services/crimeDataService";

let cachedApi: Promise<CrimeDataApi> | null = null;

function readLocalOfficialDataset(): OfficialCrimeDataset {
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

async function fetchSupabaseDataset(): Promise<OfficialCrimeDataset> {
  // Supabase Storage (bucket publico) serve o .gz; descomprime no servidor.
  if (!SUPABASE_DATASET_URL) {
    if (typeof console !== "undefined") {
      console.warn(
        "[crimeDataService.server] modo 'supabase' ativo mas NEXT_PUBLIC_SUPABASE_URL nao esta definido. A usar placeholder vazio.",
      );
    }
    return EMPTY_OFFICIAL_DATASET;
  }
  try {
    const response = await fetch(SUPABASE_DATASET_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    return JSON.parse(gunzipSync(buffer).toString("utf-8")) as OfficialCrimeDataset;
  } catch (error) {
    if (typeof console !== "undefined") {
      console.warn(
        `[crimeDataService.server] Falha ao buscar ${SUPABASE_DATASET_URL}: ${String(error)}. A usar placeholder vazio.`,
      );
    }
    return EMPTY_OFFICIAL_DATASET;
  }
}

async function buildApi(): Promise<CrimeDataApi> {
  try {
    if (isRemoteDataMode()) {
      const dataset =
        CRIME_DATA_MODE === "supabase" ? await fetchSupabaseDataset() : readLocalOfficialDataset();
      // So avisamos de "vazio" quando a leitura teve sucesso (evita aviso duplo).
      if (dataset !== EMPTY_OFFICIAL_DATASET) {
        warnIfEmptyOfficial(dataset);
      }
      // Os dados sao oficiais independentemente da origem.
      return createCrimeDataApi("official", dataset);
    }
    return createCrimeDataApi(CRIME_DATA_MODE, getStaticDataset(CRIME_DATA_MODE));
  } catch (error) {
    // Um JSON valido mas estruturalmente inesperado faria createCrimeDataApi
    // lancar; recai no placeholder em vez de propagar um 500 persistente.
    if (typeof console !== "undefined") {
      console.warn(
        `[crimeDataService.server] Falha ao inicializar a API: ${String(error)}. A usar placeholder vazio.`,
      );
    }
    return createCrimeDataApi("official", EMPTY_OFFICIAL_DATASET);
  }
}

// API resolvida no servidor, memorizada por processo (Promise para suportar a
// busca assincrona do modo supabase). As rotas de API fazem `await`.
export function getServerCrimeDataApi(): Promise<CrimeDataApi> {
  if (!cachedApi) {
    cachedApi = buildApi();
  }
  return cachedApi;
}
