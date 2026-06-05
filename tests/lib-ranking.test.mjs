import assert from "node:assert/strict";
import test from "node:test";

import { getMunicipalityRank, getRankedMunicipalities } from "../src/lib/ranking.ts";
import { makeMetric, makeMunicipality } from "./helpers/crime-fixtures.mjs";

function dataset() {
  return [
    makeMunicipality({
      idIbge: "1",
      uf: "SP",
      indicadores: { homicidioDoloso: makeMetric({ total: 10 }) },
    }),
    makeMunicipality({
      idIbge: "2",
      uf: "SP",
      indicadores: { homicidioDoloso: makeMetric({ total: 30 }) },
    }),
    makeMunicipality({
      idIbge: "3",
      uf: "RJ",
      indicadores: { homicidioDoloso: makeMetric({ total: 20 }) },
    }),
    makeMunicipality({
      idIbge: "4",
      uf: "SP",
      indicadores: { homicidioDoloso: makeMetric({ total: 5, dataStatus: "sem_dados" }) },
    }),
  ];
}

test("ordena de forma decrescente pelo valor da metrica", () => {
  const ranked = getRankedMunicipalities(dataset(), "homicidioDoloso", "total");
  assert.deepEqual(ranked.map((m) => m.idIbge), ["2", "3", "1"]);
});

test("exclui itens sem dados (valor nao finito), nunca os trata como zero", () => {
  const ranked = getRankedMunicipalities(dataset(), "homicidioDoloso", "total");
  assert.ok(!ranked.some((m) => m.idIbge === "4"), "item sem_dados nao deve aparecer");
});

test("filtra por UF quando fornecida", () => {
  const ranked = getRankedMunicipalities(dataset(), "homicidioDoloso", "total", "SP");
  assert.deepEqual(ranked.map((m) => m.idIbge), ["2", "1"]);
});

test("respeita o limite de resultados", () => {
  const ranked = getRankedMunicipalities(dataset(), "homicidioDoloso", "total", null, 1);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].idIbge, "2");
});

test("getMunicipalityRank devolve posicao 1-based", () => {
  const data = dataset();
  assert.equal(getMunicipalityRank(data, "2", "homicidioDoloso", "total"), 1);
  assert.equal(getMunicipalityRank(data, "1", "homicidioDoloso", "total"), 3);
});

test("getMunicipalityRank devolve 0 para municipio inexistente ou sem dados", () => {
  const data = dataset();
  assert.equal(getMunicipalityRank(data, "999", "homicidioDoloso", "total"), 0);
  assert.equal(getMunicipalityRank(data, "4", "homicidioDoloso", "total"), 0);
});
