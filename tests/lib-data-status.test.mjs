import assert from "node:assert/strict";
import test from "node:test";

import {
  getDataStatusDescription,
  getDataStatusLabel,
  isUnavailableStatus,
} from "../src/lib/dataStatus.ts";

const ALL_STATUSES = [
  "oficial",
  "amostra_oficial",
  "demo",
  "sem_dados",
  "zero_registrado",
  "populacao_indisponivel",
  "nao_aplicavel",
];

test("todos os estados tem rotulo e descricao nao vazios", () => {
  for (const status of ALL_STATUSES) {
    assert.ok(getDataStatusLabel(status).length > 0, `falta rotulo para ${status}`);
    assert.ok(getDataStatusDescription(status).length > 0, `falta descricao para ${status}`);
  }
});

test("isUnavailableStatus distingue ausencia de zero_registrado", () => {
  assert.equal(isUnavailableStatus("sem_dados"), true);
  assert.equal(isUnavailableStatus("nao_aplicavel"), true);
  assert.equal(isUnavailableStatus("populacao_indisponivel"), true);
  // zero registrado e um dado real (zero), nao ausencia
  assert.equal(isUnavailableStatus("zero_registrado"), false);
  assert.equal(isUnavailableStatus("amostra_oficial"), false);
  assert.equal(isUnavailableStatus("oficial"), false);
});

test("populacao_indisponivel explica a taxa cruzada", () => {
  assert.match(getDataStatusDescription("populacao_indisponivel"), /ano diferente/i);
});
