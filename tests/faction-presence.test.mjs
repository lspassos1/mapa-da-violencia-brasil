import assert from "node:assert/strict";
import test from "node:test";

import { faccoesNaUf, presencaCrimeOrg, FACTION_PRESENCE } from "../src/server/anomaly/factionPresence.ts";
import { classifySinal } from "../src/server/anomaly/electoralCycle.ts";

test("faccoesNaUf / presencaCrimeOrg: conta facções nacionais por UF (Mapa Orcrim 2024)", () => {
  assert.equal(faccoesNaUf("CE"), 2); // PCC + CV
  assert.equal(presencaCrimeOrg("CE"), "alta");
  assert.equal(faccoesNaUf("SP"), 1); // só PCC
  assert.equal(presencaCrimeOrg("SP"), "media");
  assert.equal(faccoesNaUf("RJ"), 1); // só CV (na fonte; milícias à parte)
  assert.equal(faccoesNaUf("DF"), 0); // nenhuma documentada
  assert.equal(presencaCrimeOrg("DF"), "baixa");
  assert.equal(faccoesNaUf("RS"), 0);
  assert.equal(faccoesNaUf("ZZ"), 0); // UF inexistente -> 0
});

test("FACTION_PRESENCE cobre as 27 UFs", () => {
  assert.equal(Object.keys(FACTION_PRESENCE).length, 27);
});

test("classifySinal: cruza efeito vs pares COM presença de facção (princípio do #85)", () => {
  // robusto + cai mais que os pares + facção -> forte
  assert.equal(classifySinal("CE", -0.117, true).sinal, "forte");
  // robusto + cai mais que os pares, MAS sem facção documentada -> isolado (não promovido)
  assert.equal(classifySinal("DF", -0.2, true).sinal, "isolado");
  // robusto mas sem desvio relevante -> sem_desvio
  assert.equal(classifySinal("CE", -0.01, true).sinal, "sem_desvio");
  // não robusto -> baixa_amostra (mesmo com queda)
  assert.equal(classifySinal("AP", -0.143, false).sinal, "baixa_amostra");
  // efeito relativo nulo -> sem_desvio
  assert.equal(classifySinal("CE", null, true).sinal, "sem_desvio");
});
