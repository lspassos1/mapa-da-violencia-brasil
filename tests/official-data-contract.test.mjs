import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dataset = JSON.parse(
  await readFile(new URL("../src/data/officialCrimeData.sample.json", import.meta.url), "utf-8"),
);
const etlSampleDataset = JSON.parse(
  await readFile(new URL("../etl/samples/crime_map_app_ready.sample.json", import.meta.url), "utf-8"),
);

test("official sample is explicitly marked and scoped", () => {
  assert.equal(dataset.status.mode, "official_sample");
  assert.equal(dataset.status.unit, "vitimas");
  assert.match(dataset.status.source, /SINESP/);
  assert.ok(dataset.status.limitations.some((item) => item.includes("amostra")));
});

test("official sample exposes only official homicide indicator", () => {
  assert.deepEqual(
    dataset.indicators.map((indicator) => indicator.key),
    ["homicidioDoloso"],
  );
  assert.equal(dataset.indicators[0].codigo, "homicidio_doloso");
  assert.equal(dataset.indicators[0].oficial, true);
});

test("items never encode missing data as zero", () => {
  for (const item of dataset.items) {
    const metric = item.indicadores.homicidioDoloso;
    assert.ok(metric, `${item.idIbge} should include homicidioDoloso`);
    if (metric.total === 0) {
      assert.equal(metric.dataStatus, "zero_registrado");
    } else {
      assert.equal(metric.dataStatus, "amostra_oficial");
    }
  }
});

test("official sample metrics expose unavailable variation fields explicitly", () => {
  for (const item of dataset.items) {
    const metric = item.indicadores.homicidioDoloso;
    assert.ok(Object.hasOwn(metric, "variacaoMensal"));
    assert.ok(Object.hasOwn(metric, "variacaoAnual"));
    assert.equal(metric.variacaoMensal, null);
    assert.equal(metric.variacaoAnual, null);
  }
});

test("etl app-ready sample metrics match unavailable variation contract", () => {
  for (const item of etlSampleDataset.items) {
    const metric = item.indicadores.homicidioDoloso;
    assert.ok(Object.hasOwn(metric, "variacaoMensal"));
    assert.ok(Object.hasOwn(metric, "variacaoAnual"));
    assert.equal(metric.variacaoMensal, null);
    assert.equal(metric.variacaoAnual, null);
  }
});
