import assert from "node:assert/strict";
import test from "node:test";

import { getBoundsForData } from "../src/lib/mapNavigation.ts";

test("getBoundsForData devolve null sem pontos", () => {
  assert.equal(getBoundsForData([]), null);
});

test("getBoundsForData enquadra a extensao dos pontos", () => {
  const acre = [
    { lat: -9.975, lng: -67.824 }, // Rio Branco
    { lat: -7.627, lng: -72.675 }, // Cruzeiro do Sul
    { lat: -10.566, lng: -67.686 }, // Capixaba
  ];
  const [west, south, east, north] = getBoundsForData(acre);
  assert.equal(west, -72.675);
  assert.equal(east, -67.686);
  assert.equal(south, -10.566);
  assert.equal(north, -7.627);
});

test("getBoundsForData ignora pontos com coordenada nao finita", () => {
  const bounds = getBoundsForData([
    { lat: -23, lng: -46 },
    { lat: Number.NaN, lng: -50 }, // descartado (lat invalida)
    { lat: -22, lng: Number.POSITIVE_INFINITY }, // descartado (lng invalida)
    { lat: -20, lng: -44 }, // valido, estende a caixa
  ]);
  assert.deepEqual(bounds, [-46, -23, -44, -20]);
});

test("getBoundsForData devolve null quando todos os pontos sao invalidos", () => {
  assert.equal(getBoundsForData([{ lat: Number.NaN, lng: Number.NaN }]), null);
});
