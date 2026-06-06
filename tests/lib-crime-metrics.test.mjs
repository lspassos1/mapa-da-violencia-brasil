import assert from "node:assert/strict";
import test from "node:test";

import { getMetricValue, getMetricValueFromMetric } from "../src/lib/crimeMetrics.ts";
import { makeMetric, makeMunicipality } from "./helpers/crime-fixtures.mjs";

test("getMetricValueFromMetric extrai o campo certo por viewMode", () => {
  const metric = makeMetric({ score: 73, total: 250, taxa100k: 18.4, variacaoMensal: -3.2 });
  assert.equal(getMetricValueFromMetric(metric, "score"), 73);
  assert.equal(getMetricValueFromMetric(metric, "total"), 250);
  assert.equal(getMetricValueFromMetric(metric, "taxa100k"), 18.4);
  assert.equal(getMetricValueFromMetric(metric, "variacaoMensal"), -3.2);
});

test("getMetricValueFromMetric devolve -Infinity quando taxa/variacao sao null", () => {
  const metric = makeMetric({ taxa100k: null, variacaoMensal: null });
  assert.equal(getMetricValueFromMetric(metric, "taxa100k"), Number.NEGATIVE_INFINITY);
  assert.equal(getMetricValueFromMetric(metric, "variacaoMensal"), Number.NEGATIVE_INFINITY);
});

test("getMetricValue trata sem_dados e nao_aplicavel como ausencia (-Infinity)", () => {
  for (const dataStatus of ["sem_dados", "nao_aplicavel"]) {
    const item = makeMunicipality({
      indicadores: { homicidioDoloso: makeMetric({ dataStatus, total: 999 }) },
    });
    assert.equal(getMetricValue(item, "homicidioDoloso", "total"), Number.NEGATIVE_INFINITY);
  }
});

test("getMetricValue devolve -Infinity quando o indicador nao existe no item", () => {
  const item = makeMunicipality({ indicadores: {} });
  assert.equal(getMetricValue(item, "homicidioDoloso", "score"), Number.NEGATIVE_INFINITY);
});

test("getMetricValue devolve o valor quando os dados existem", () => {
  const item = makeMunicipality({
    indicadores: { homicidioDoloso: makeMetric({ dataStatus: "amostra_oficial", total: 42 }) },
  });
  assert.equal(getMetricValue(item, "homicidioDoloso", "total"), 42);
});

test("zero_registrado e um zero real (valor finito 0), nao ausencia de dado", () => {
  // Distincao critica: zero_registrado significa "registou zero ocorrencias",
  // logo o valor 0 e finito e entra no ranking; sem_dados/nao_aplicavel sao
  // ausencia (-Infinity) e ficam de fora.
  const zero = makeMunicipality({
    indicadores: { homicidioDoloso: makeMetric({ dataStatus: "zero_registrado", total: 0 }) },
  });
  assert.equal(getMetricValue(zero, "homicidioDoloso", "total"), 0);
  assert.ok(Number.isFinite(getMetricValue(zero, "homicidioDoloso", "total")));

  const semDados = makeMunicipality({
    indicadores: { homicidioDoloso: makeMetric({ dataStatus: "sem_dados", total: 0 }) },
  });
  assert.equal(getMetricValue(semDados, "homicidioDoloso", "total"), Number.NEGATIVE_INFINITY);
});

test("getMetricValue com taxa100k suprimida (null) nao ranqueia como zero", () => {
  const item = makeMunicipality({
    indicadores: { homicidioDoloso: makeMetric({ dataStatus: "amostra_oficial", taxa100k: null }) },
  });
  // populacao_indisponivel/amostra com taxa null deve cair para -Infinity na vista de taxa,
  // nunca 0 (que seria interpretado como "registou zero").
  assert.equal(getMetricValue(item, "homicidioDoloso", "taxa100k"), Number.NEGATIVE_INFINITY);
});
