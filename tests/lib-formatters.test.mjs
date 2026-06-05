import assert from "node:assert/strict";
import test from "node:test";

import { formatDecimal, formatMetricValue, formatNumber } from "../src/lib/formatters.ts";

test("formatNumber usa agrupamento de milhares pt-BR", () => {
  assert.equal(formatNumber(1234567), "1.234.567");
  assert.equal(formatNumber(0), "0");
});

test("formatDecimal trata null e valores nao finitos como Indisponivel", () => {
  assert.equal(formatDecimal(null), "Indisponivel");
  assert.equal(formatDecimal(Number.POSITIVE_INFINITY), "Indisponivel");
  assert.equal(formatDecimal(Number.NaN), "Indisponivel");
});

test("formatDecimal usa virgula decimal e uma casa", () => {
  assert.equal(formatDecimal(9.1), "9,1");
  assert.equal(formatDecimal(20), "20,0");
});

test("formatMetricValue devolve 'Sem dados' para valores nao finitos", () => {
  assert.equal(formatMetricValue(Number.NEGATIVE_INFINITY, "total"), "Sem dados");
  assert.equal(formatMetricValue(Number.NaN, "taxa100k"), "Sem dados");
});

test("formatMetricValue formata por viewMode", () => {
  assert.equal(formatMetricValue(1500, "total"), "1.500");
  assert.equal(formatMetricValue(12.3, "taxa100k"), "12,3 / 100 mil");
  assert.equal(formatMetricValue(73.4, "score"), "73/100");
});

test("formatMetricValue sinaliza variacao mensal com sinal explicito", () => {
  assert.equal(formatMetricValue(4.2, "variacaoMensal"), "+4,2%");
  assert.equal(formatMetricValue(-4.2, "variacaoMensal"), "-4,2%");
});
