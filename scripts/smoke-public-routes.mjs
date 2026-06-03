const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const forbiddenRawPathPatterns = [
  /data\/raw/i,
  /data\/manual/i,
  /\.part\b/i,
  /sinesp_vde\.zip/i,
];
const expectedDataMode =
  process.env.SMOKE_EXPECT_DATA_MODE ??
  (process.env.NEXT_PUBLIC_CRIME_DATA_MODE === "official_sample" ? "official_sample" : "demo");

await expectOkText("/", /Mapa da Violencia Brasil/);
await expectOkText("/metodologia", /Metodologia/);

const health = await expectOkJson("/api/health");
assertEqual(health.status, "ok", "/api/health status");
assertEqual(health.service, "mapa-da-violencia-brasil", "/api/health service");

const metadata = await expectOkJson("/api/metadata");
assertArray(metadata.indicadores, "/api/metadata indicadores");
assertArray(metadata.periodos, "/api/metadata periodos");
assertArray(metadata.modos, "/api/metadata modos");
assertObject(metadata.filtrosPadrao, "/api/metadata filtrosPadrao");
assertDataMode(metadata.modoDados, "/api/metadata modoDados");
assertEqual(metadata.modoDados, expectedDataMode, "/api/metadata modoDados");

const crimeMap = await expectOkJson("/api/crime-map");
assertEqual(crimeMap.demo, expectedDataMode === "demo", "/api/crime-map demo");
assertArray(crimeMap.items, "/api/crime-map items");
assertArray(crimeMap.ranking, "/api/crime-map ranking");
assertObject(crimeMap.fonteResumo, "/api/crime-map fonteResumo");
assertDataMode(crimeMap.fonteResumo.modo, "/api/crime-map fonteResumo.modo");
assertEqual(crimeMap.fonteResumo.modo, expectedDataMode, "/api/crime-map fonteResumo.modo");
assertObject(crimeMap.metadata, "/api/crime-map metadata");

const sources = await expectOkJson("/api/sources/status");
assertArray(sources.fontes, "/api/sources/status fontes");
if (!sources.fontes.some((source) => source.status === expectedDataMode)) {
  throw new Error("/api/sources/status should expose the active crime data mode");
}

const defaultPeriod = metadata.filtrosPadrao.period;
const defaultMunicipalityId = expectedDataMode === "demo" ? "3550308" : "1200401";
const municipalityId = process.env.SMOKE_MUNICIPALITY_ID ?? defaultMunicipalityId;
const municipalityPath = `/api/municipalities/${municipalityId}?periodo=${encodeURIComponent(defaultPeriod)}`;
const municipality = await expectOkJson(municipalityPath);
assertEqual(municipality.demo, expectedDataMode === "demo", `${municipalityPath} demo`);
assertObject(municipality.item, `${municipalityPath} item`);
assertEqual(municipality.item.idIbge, municipalityId, `${municipalityPath} idIbge`);
assertObject(municipality.status, `${municipalityPath} status`);
assertDataMode(municipality.status.mode ?? "demo", `${municipalityPath} status.mode`);
assertEqual(municipality.status.mode ?? "demo", expectedDataMode, `${municipalityPath} status.mode`);

async function expectOkText(path, expectedPattern) {
  const response = await fetch(`${baseUrl}${path}`);
  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}`);
  }

  const body = await response.text();
  assertNoRawPathLeak(path, body);
  if (!expectedPattern.test(body)) {
    throw new Error(`${path} did not include expected page marker`);
  }

  console.log(`${response.status} ${path}`);
  return body;
}

async function expectOkJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(`${path} returned ${contentType || "no content-type"} instead of JSON`);
  }

  const json = await response.json();
  assertNoRawPathLeak(path, json);
  console.log(`${response.status} ${path}`);
  return json;
}

function assertNoRawPathLeak(path, value) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  for (const pattern of forbiddenRawPathPatterns) {
    if (pattern.test(serialized)) {
      throw new Error(`${path} leaked raw/local data path matching ${pattern}`);
    }
  }
}

function assertArray(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} should be a non-empty array`);
  }
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} should be an object`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} should be ${expected}, received ${actual}`);
  }
}

function assertDataMode(value, label) {
  if (!["demo", "official_sample", "official"].includes(value)) {
    throw new Error(`${label} should identify demo, official_sample or official; received ${value}`);
  }
}
