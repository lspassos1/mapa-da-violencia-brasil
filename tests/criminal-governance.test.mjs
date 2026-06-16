import assert from "node:assert/strict";
import test from "node:test";

import { getRjCriminalGovernance, ANO_REF } from "../src/server/anomaly/criminalGovernance.ts";

test("lente 2 RJ: combina Fogo Cruzado + ISP e classifica", () => {
  const rows = getRjCriminalGovernance(ANO_REF);
  assert.ok(Array.isArray(rows) && rows.length >= 10, "deve cobrir os municípios com tiroteios");

  // ordenação: 'controle' antes de 'disputa' antes de 'misto'
  const ordem = { controle: 0, disputa: 1, misto: 2 };
  for (let i = 1; i < rows.length; i++) {
    assert.ok(ordem[rows[i - 1].classificacao] <= ordem[rows[i].classificacao], "ordenado por classificação");
  }

  const porMun = Object.fromEntries(rows.map((r) => [r.municipio, r]));

  // Rio: muita "Disputa" -> disputa ativa
  const rio = porMun["Rio de Janeiro"];
  assert.ok(rio, "Rio presente");
  assert.equal(rio.classificacao, "disputa");
  assert.ok(rio.disputaShare >= 0.1);

  // São Gonçalo: violência armada SEM 'Disputa' -> indício de controle/monopólio
  const sg = porMun["São Gonçalo"];
  assert.ok(sg, "São Gonçalo presente");
  assert.equal(sg.classificacao, "controle");
  assert.ok(sg.disputaShare <= 0.03 && sg.robusto);

  // join ISP funcionou (extorsão presente nos grandes municípios)
  assert.ok(typeof sg.extorsao === "number" && sg.extorsao > 0, "extorsão do ISP juntada");
});

test("lente 2 RJ: município de poucos tiroteios é 'misto' (não-robusto)", () => {
  const rows = getRjCriminalGovernance(ANO_REF);
  for (const r of rows) {
    if (!r.robusto) assert.equal(r.classificacao, "misto", `${r.municipio} não-robusto deve ser misto`);
  }
});
