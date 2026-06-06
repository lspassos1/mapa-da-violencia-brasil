import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { stateMapData } from "../src/data/stateGeometries.ts";

const mesh = JSON.parse(
  await readFile(new URL("../src/data/brazilStatesMesh.json", import.meta.url), "utf-8"),
);

test("a malha e uma FeatureCollection com 27 UFs", () => {
  assert.equal(mesh.type, "FeatureCollection");
  assert.equal(mesh.features.length, 27);
});

test("cada feature tem uf, nome e geometria poligonal valida", () => {
  for (const feature of mesh.features) {
    assert.equal(feature.type, "Feature");
    assert.ok(feature.properties?.uf, "feature precisa de properties.uf");
    assert.ok(feature.properties?.nome, "feature precisa de properties.nome");
    assert.ok(
      ["Polygon", "MultiPolygon"].includes(feature.geometry?.type),
      `${feature.properties?.uf}: geometria deve ser Polygon/MultiPolygon`,
    );
    assert.ok(Array.isArray(feature.geometry.coordinates) && feature.geometry.coordinates.length > 0);
  }
});

test("as UFs da malha coincidem exatamente com stateMapData", () => {
  const meshUfs = mesh.features.map((feature) => feature.properties.uf).sort();
  const mapUfs = stateMapData.map((state) => state.uf).sort();
  assert.deepEqual(meshUfs, mapUfs);
});

test("nao ha UF duplicada na malha", () => {
  const ufs = mesh.features.map((feature) => feature.properties.uf);
  assert.equal(new Set(ufs).size, ufs.length);
});

test("os centroides de stateMapData caem dentro da caixa da malha", () => {
  function bbox(geometry) {
    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
    const visit = (coords) => {
      if (typeof coords[0] === "number") {
        const [lon, lat] = coords;
        minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
      } else {
        for (const c of coords) visit(c);
      }
    };
    visit(geometry.coordinates);
    return { minLon, minLat, maxLon, maxLat };
  }
  for (const feature of mesh.features) {
    const state = stateMapData.find((s) => s.uf === feature.properties.uf);
    const { minLon, minLat, maxLon, maxLat } = bbox(feature.geometry);
    const [lon, lat] = state.centroid;
    // O centroide aproximado deve cair dentro da caixa real do estado; folga de
    // 0.1 grau (~11 km) so para absorver artefactos de simplificacao da malha.
    const tol = 0.1;
    assert.ok(lon >= minLon - tol && lon <= maxLon + tol, `${state.uf}: centroid lon fora da malha`);
    assert.ok(lat >= minLat - tol && lat <= maxLat + tol, `${state.uf}: centroid lat fora da malha`);
  }
});
