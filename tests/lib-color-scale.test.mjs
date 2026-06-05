import assert from "node:assert/strict";
import test from "node:test";

import { getScoreColor, getScoreRadius, riskColors } from "../src/lib/colorScale.ts";

test("getScoreColor respeita as fronteiras 20/40/60/80", () => {
  assert.equal(getScoreColor(0), riskColors.baixo);
  assert.equal(getScoreColor(20), riskColors.baixo);
  assert.equal(getScoreColor(20.01), riskColors.moderado);
  assert.equal(getScoreColor(40), riskColors.moderado);
  assert.equal(getScoreColor(40.01), riskColors.atencao);
  assert.equal(getScoreColor(60), riskColors.atencao);
  assert.equal(getScoreColor(60.01), riskColors.alto);
  assert.equal(getScoreColor(80), riskColors.alto);
  assert.equal(getScoreColor(80.01), riskColors.critico);
  assert.equal(getScoreColor(100), riskColors.critico);
});

test("getScoreRadius fica entre 7 e 22", () => {
  assert.equal(getScoreRadius(0), 7);
  assert.equal(getScoreRadius(-50), 7, "nunca abaixo do minimo");
  assert.equal(getScoreRadius(60), 17); // 7 + 60/6
  assert.equal(getScoreRadius(1000), 22, "nunca acima do maximo");
});
