import assert from "node:assert/strict";
import test from "node:test";

import { ufDatumToMunicipality } from "../src/lib/ufDisplay.ts";
import { getMetricValue } from "../src/lib/crimeMetrics.ts";

const DATUM = {
  uf: "SP",
  periodo: "2025",
  indicador: "rouboVeiculos",
  total: 25024,
  taxa100k: 54.3,
  score: 94,
  nivel: "critico",
  unidade: "ocorrencias",
  dataStatus: "oficial",
};

test("ufDatumToMunicipality cria um item rankeavel com a sigla como id/uf", () => {
  const item = ufDatumToMunicipality(DATUM, "Sao Paulo");
  assert.equal(item.idIbge, "SP");
  assert.equal(item.uf, "SP");
  assert.equal(item.municipio, "Sao Paulo");
  assert.equal(item.periodo, "2025");
  // o indicador fica disponivel para a ordenacao por total/taxa/score.
  assert.equal(getMetricValue(item, "rouboVeiculos", "total"), 25024);
  assert.equal(getMetricValue(item, "rouboVeiculos", "taxa100k"), 54.3);
  assert.equal(getMetricValue(item, "rouboVeiculos", "score"), 94);
});

test("ufDatumToMunicipality propaga a variacaoAnual do registo estadual", () => {
  // Sem isto, o ranking de estados no modo 'variacao anual' ficaria vazio para
  // os indicadores so-UF (variacaoAnual hardcoded a null).
  const withVar = ufDatumToMunicipality({ ...DATUM, variacaoAnual: -7.3 }, "Sao Paulo");
  assert.equal(withVar.indicadores.rouboVeiculos.variacaoAnual, -7.3);
  const withoutVar = ufDatumToMunicipality(DATUM, "Sao Paulo");
  assert.equal(withoutVar.indicadores.rouboVeiculos.variacaoAnual, null);
});

test("ufDatumToMunicipality preserva taxa null (sem inventar 0)", () => {
  const item = ufDatumToMunicipality({ ...DATUM, taxa100k: null }, "Sao Paulo");
  assert.equal(item.indicadores.rouboVeiculos.taxa100k, null);
});
