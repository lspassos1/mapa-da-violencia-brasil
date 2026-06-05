import assert from "node:assert/strict";
import test from "node:test";

import { getRiskLevel, riskLevelLabels } from "../src/lib/riskLevel.ts";

test("getRiskLevel mapeia score nas fronteiras 20/40/60/80", () => {
  assert.equal(getRiskLevel(0), "baixo");
  assert.equal(getRiskLevel(20), "baixo");
  assert.equal(getRiskLevel(20.01), "moderado");
  assert.equal(getRiskLevel(40), "moderado");
  assert.equal(getRiskLevel(40.01), "atencao");
  assert.equal(getRiskLevel(60), "atencao");
  assert.equal(getRiskLevel(60.01), "alto");
  assert.equal(getRiskLevel(80), "alto");
  assert.equal(getRiskLevel(80.01), "critico");
  assert.equal(getRiskLevel(100), "critico");
});

test("riskLevelLabels cobre todos os niveis com rotulo legivel", () => {
  for (const level of ["baixo", "moderado", "atencao", "alto", "critico"]) {
    assert.ok(riskLevelLabels[level], `falta rotulo para ${level}`);
  }
});

test("getScoreColor e getRiskLevel concordam nas fronteiras", async () => {
  const { getScoreColor, riskColors } = await import("../src/lib/colorScale.ts");
  for (const score of [0, 20, 21, 40, 41, 60, 61, 80, 81, 100]) {
    const level = getRiskLevel(score);
    assert.equal(getScoreColor(score), riskColors[level], `score ${score} divergente`);
  }
});
