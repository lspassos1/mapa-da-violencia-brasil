import assert from "node:assert/strict";
import test from "node:test";

import { classifyGovernance, getCriminalGovernanceNacional } from "../src/server/anomaly/criminalGovernanceNacional.ts";

test("classifyGovernance: facção + intensidade decide controle×disputa", () => {
  // facção presente + intensidade bem abaixo da mediana -> controle/pax (caso SP/PCC)
  assert.equal(classifyGovernance(0.5, 1), "controle");
  // facção + intensidade bem acima -> disputa (caso Norte)
  assert.equal(classifyGovernance(1.6, 2), "disputa");
  // facção + perto da mediana -> misto
  assert.equal(classifyGovernance(1.0, 2), "misto");
  // sem facção -> não classifica (sem_faccao), independente da intensidade
  assert.equal(classifyGovernance(0.4, 0), "sem_faccao");
  assert.equal(classifyGovernance(2.0, 0), "sem_faccao");
});

test("getCriminalGovernanceNacional: nacional (27 UFs), SP=controle, Norte=disputa", () => {
  const out = getCriminalGovernanceNacional();
  assert.ok(out.ufs.length >= 20, "cobre as UFs");
  assert.ok(out.mediana > 0, "mediana nacional calculada");
  assert.ok(out.fonte.includes("DATASUS"));
  const sp = out.ufs.find((u) => u.uf === "SP");
  assert.equal(sp?.classificacao, "controle"); // pax monopolista do PCC (caso canônico)
  const norte = out.ufs.filter((u) => ["AM", "AP", "RR", "PA"].includes(u.uf));
  assert.ok(norte.some((u) => u.classificacao === "disputa"), "Norte com disputa");
  // RS/DF não têm facção nacional documentada -> sem_faccao
  assert.equal(out.ufs.find((u) => u.uf === "RS")?.classificacao, "sem_faccao");
});
