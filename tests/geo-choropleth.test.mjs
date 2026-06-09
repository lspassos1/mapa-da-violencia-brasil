import assert from "node:assert/strict";
import test from "node:test";

import { getScoreColor, riskColors } from "../src/lib/colorScale.ts";
import {
  buildMunicipalFillColorExpression,
  buildStateFillColorExpression,
  colorizeMunicipalMesh,
  computeMunicipalChoropleth,
  computeStateChoropleth,
  computeStateChoroplethFromUf,
  municipalColorById,
} from "../src/services/geoService.ts";
import { makeMetric, makeMunicipality } from "./helpers/crime-fixtures.mjs";

function muni(uf, total, overrides = {}) {
  return makeMunicipality({
    uf,
    indicadores: { homicidioDoloso: makeMetric({ total, dataStatus: "amostra_oficial" }) },
    ...overrides,
  });
}

test("computeStateChoropleth ordena as UFs do menor para o maior por quantil de rank", () => {
  // 5 UFs com totais crescentes -> uma cor por bucket (baixo..critico).
  const data = [
    muni("AC", 1),
    muni("AL", 10),
    muni("AP", 100),
    muni("AM", 1000),
    muni("BA", 10000),
  ];
  const choropleth = computeStateChoropleth(data, "homicidioDoloso", "total");
  const byUf = Object.fromEntries(choropleth.map((entry) => [entry.uf, entry.color]));
  assert.equal(byUf.AC, riskColors.baixo);
  assert.equal(byUf.AL, riskColors.moderado);
  assert.equal(byUf.AP, riskColors.atencao);
  assert.equal(byUf.AM, riskColors.alto);
  assert.equal(byUf.BA, riskColors.critico);
});

test("computeStateChoropleth soma municipios da mesma UF e exclui sem_dados", () => {
  const data = [
    muni("SP", 100),
    muni("SP", 50),
    makeMunicipality({
      uf: "RJ",
      indicadores: { homicidioDoloso: makeMetric({ dataStatus: "sem_dados", total: 999 }) },
    }),
  ];
  const choropleth = computeStateChoropleth(data, "homicidioDoloso", "total");
  const sp = choropleth.find((entry) => entry.uf === "SP");
  assert.equal(sp.value, 150);
  assert.ok(!choropleth.some((entry) => entry.uf === "RJ"), "UF sem dados nao entra no degrade");
});

test("computeStateChoropleth no modo taxa usa vitimas por 100 mil (populacao agregada)", () => {
  const data = [
    muni("SP", 200, { populacao: 100000 }), // 200/100000*100000 = 200
    muni("MG", 50, { populacao: 100000 }), //  50
  ];
  const scale = [riskColors.baixo, riskColors.moderado, riskColors.atencao, riskColors.alto, riskColors.critico];
  const choropleth = computeStateChoropleth(data, "homicidioDoloso", "taxa100k");
  const sp = choropleth.find((entry) => entry.uf === "SP");
  const mg = choropleth.find((entry) => entry.uf === "MG");
  assert.equal(sp.value, 200);
  assert.equal(mg.value, 50);
  // Maior taxa -> bucket de violencia mais alto que a menor taxa.
  assert.ok(scale.indexOf(sp.color) > scale.indexOf(mg.color));
  assert.equal(mg.color, riskColors.baixo);
});

test("buildStateFillColorExpression devolve uma expressao match valida do MapLibre", () => {
  const expr = buildStateFillColorExpression([
    { uf: "SP", value: 10, color: "#aaa" },
    { uf: "RJ", value: 5, color: "#bbb" },
  ]);
  assert.ok(Array.isArray(expr));
  assert.equal(expr[0], "match");
  assert.deepEqual(expr[1], ["get", "uf"]);
  assert.deepEqual(expr.slice(2, 6), ["SP", "#aaa", "RJ", "#bbb"]);
  assert.equal(typeof expr[expr.length - 1], "string"); // fallback de UF sem dados
});

test("buildStateFillColorExpression com lista vazia devolve uma cor solida (fallback)", () => {
  const expr = buildStateFillColorExpression([]);
  assert.equal(typeof expr, "string");
});

test("computeMunicipalChoropleth pinta so a UF pedida, por score, ignorando sem_dados", () => {
  const data = [
    makeMunicipality({ idIbge: "3500001", uf: "SP", indicadores: { homicidioDoloso: makeMetric({ score: 90 }) } }),
    makeMunicipality({ idIbge: "3500002", uf: "SP", indicadores: { homicidioDoloso: makeMetric({ score: 10 }) } }),
    makeMunicipality({ idIbge: "3300001", uf: "RJ", indicadores: { homicidioDoloso: makeMetric({ score: 50 }) } }),
    makeMunicipality({ idIbge: "3500003", uf: "SP", indicadores: { homicidioDoloso: makeMetric({ dataStatus: "sem_dados" }) } }),
  ];
  const choropleth = computeMunicipalChoropleth(data, "homicidioDoloso", "SP");
  const byId = Object.fromEntries(choropleth.map((entry) => [entry.id, entry.color]));
  assert.deepEqual(Object.keys(byId).sort(), ["3500001", "3500002"]);
  assert.equal(byId["3500001"], getScoreColor(90));
  assert.equal(byId["3500002"], getScoreColor(10));
});

test("buildMunicipalFillColorExpression casa por `id` (id_ibge) com fallback", () => {
  const expr = buildMunicipalFillColorExpression([
    { id: "3500001", color: "#aaa" },
    { id: "3500002", color: "#bbb" },
  ]);
  assert.ok(Array.isArray(expr));
  assert.equal(expr[0], "match");
  assert.deepEqual(expr[1], ["get", "id"]);
  assert.deepEqual(expr.slice(2, 6), ["3500001", "#aaa", "3500002", "#bbb"]);
  assert.equal(typeof expr[expr.length - 1], "string");
});

test("buildMunicipalFillColorExpression vazio devolve cor solida (fallback)", () => {
  assert.equal(typeof buildMunicipalFillColorExpression([]), "string");
});

test("municipalColorById mapeia id_ibge -> cor por score, so da UF, ignorando sem_dados", () => {
  const data = [
    makeMunicipality({ idIbge: "1700251", uf: "TO", indicadores: { homicidioDoloso: makeMetric({ score: 95 }) } }),
    makeMunicipality({ idIbge: "1700300", uf: "TO", indicadores: { homicidioDoloso: makeMetric({ score: 5 }) } }),
    makeMunicipality({ idIbge: "3500001", uf: "SP", indicadores: { homicidioDoloso: makeMetric({ score: 50 }) } }),
    makeMunicipality({ idIbge: "1700400", uf: "TO", indicadores: { homicidioDoloso: makeMetric({ dataStatus: "sem_dados" }) } }),
  ];
  const colors = municipalColorById(data, "homicidioDoloso", "TO");
  assert.deepEqual(Object.keys(colors).sort(), ["1700251", "1700300"]);
  assert.equal(colors["1700251"], getScoreColor(95));
  assert.equal(colors["1700300"], getScoreColor(5));
});

test("colorizeMunicipalMesh injeta properties.color por id (fallback p/ sem dado)", () => {
  const mesh = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: { id: "1700251" }, geometry: { type: "Polygon", coordinates: [] } },
      { type: "Feature", properties: { id: "9999999" }, geometry: { type: "Polygon", coordinates: [] } },
    ],
  };
  const out = colorizeMunicipalMesh(mesh, { "1700251": "#abc123" });
  assert.equal(out.features[0].properties.color, "#abc123");
  assert.equal(typeof out.features[1].properties.color, "string"); // fallback
  assert.equal(out.features[0].properties.id, "1700251"); // preserva props originais
});

test("computeStateChoroplethFromUf colore pelo score do ETL (coerente com o nivel)", () => {
  const ufData = [
    { uf: "AC", score: 10, total: 5, taxa100k: 50 },
    { uf: "SP", score: 95, total: 1000, taxa100k: 10 },
  ];
  const byUf = Object.fromEntries(computeStateChoroplethFromUf(ufData, "total").map((e) => [e.uf, e.color]));
  assert.equal(byUf.AC, getScoreColor(10)); // baixo
  assert.equal(byUf.SP, getScoreColor(95)); // critico
});

test("computeStateChoroplethFromUf usa total ou taxa no `value` conforme o modo", () => {
  const ufData = [{ uf: "RJ", score: 80, total: 1000, taxa100k: 146.5 }];
  assert.equal(computeStateChoroplethFromUf(ufData, "total")[0].value, 1000);
  assert.equal(computeStateChoroplethFromUf(ufData, "taxa100k")[0].value, 146.5);
});

test("computeStateChoroplethFromUf trata taxa null como 0 no modo taxa", () => {
  const result = computeStateChoroplethFromUf(
    [{ uf: "AM", score: 50, total: 9, taxa100k: null }],
    "taxa100k",
  );
  assert.equal(result[0].value, 0);
});
