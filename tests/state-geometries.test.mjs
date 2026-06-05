import assert from "node:assert/strict";
import test from "node:test";

import { brazilBounds, stateMapData } from "../src/data/stateGeometries.ts";

const EXPECTED_UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

test("cobre exatamente as 27 unidades federativas", () => {
  assert.equal(stateMapData.length, 27);
  const ufs = stateMapData.map((state) => state.uf);
  assert.deepEqual([...ufs].sort(), [...EXPECTED_UFS].sort());
});

test("nao ha UF duplicada", () => {
  const ufs = stateMapData.map((state) => state.uf);
  assert.equal(new Set(ufs).size, ufs.length);
});

test("cada estado tem nome e geometria validos", () => {
  for (const state of stateMapData) {
    assert.ok(state.nome && state.nome.trim().length > 0, `${state.uf} precisa de nome`);
    assert.equal(state.bounds.length, 4, `${state.uf} precisa de 4 bounds`);
    assert.equal(state.centroid.length, 2, `${state.uf} precisa de centroid [lon, lat]`);
  }
});

test("bounds sao coerentes (oeste < leste, sul < norte)", () => {
  for (const state of stateMapData) {
    const [west, south, east, north] = state.bounds;
    assert.ok(west < east, `${state.uf}: oeste (${west}) deve ser menor que leste (${east})`);
    assert.ok(south < north, `${state.uf}: sul (${south}) deve ser menor que norte (${north})`);
  }
});

test("centroid de cada estado cai dentro dos seus bounds", () => {
  for (const state of stateMapData) {
    const [west, south, east, north] = state.bounds;
    const [lon, lat] = state.centroid;
    assert.ok(lon >= west && lon <= east, `${state.uf}: centroid lon ${lon} fora de [${west}, ${east}]`);
    assert.ok(lat >= south && lat <= north, `${state.uf}: centroid lat ${lat} fora de [${south}, ${north}]`);
  }
});

test("todos os estados estao contidos na caixa nacional", () => {
  const [bWest, bSouth, bEast, bNorth] = brazilBounds;
  for (const state of stateMapData) {
    const [west, south, east, north] = state.bounds;
    assert.ok(west >= bWest && east <= bEast, `${state.uf}: longitude fora da caixa nacional`);
    assert.ok(south >= bSouth && north <= bNorth, `${state.uf}: latitude fora da caixa nacional`);
  }
});
