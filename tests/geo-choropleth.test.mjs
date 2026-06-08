import assert from "node:assert/strict";
import test from "node:test";

import { riskColors } from "../src/lib/colorScale.ts";
import { buildStateFillColorExpression, computeStateChoropleth } from "../src/services/geoService.ts";
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
