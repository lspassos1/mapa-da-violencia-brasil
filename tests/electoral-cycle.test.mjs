import assert from "node:assert/strict";
import test from "node:test";

import { computeUfAnomaly, getElectoralAnomalies, ELECTION_YEARS } from "../src/server/anomaly/electoralCycle.ts";

// Constrói uma série mensal: cfg = { ano: { pre, other } } (pre = ago/set/out).
function mkSeries(cfg) {
  const s = {};
  for (const [ano, { pre, other }] of Object.entries(cfg)) {
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, "0");
      s[`${ano}-${mm}`] = [8, 9, 10].includes(m) ? pre : other;
    }
  }
  return s;
}

const ELEC = ELECTION_YEARS; // [2016,2018,2020,2022,2024]
const NORMAL = [2015, 2017, 2019, 2021, 2023];

function cfgWith({ elecPre, elecOther, normPre, normOther }) {
  const cfg = {};
  for (const y of ELEC) cfg[y] = { pre: elecPre, other: elecOther };
  for (const y of NORMAL) cfg[y] = { pre: normPre, other: normOther };
  return cfg;
}

test("efeito negativo quando homicídio cai na janela pré-eleitoral só em anos de eleição", () => {
  // anos normais: estável (índice ~1.0); anos de eleição: ago-out caem à metade.
  const serie = mkSeries(cfgWith({ elecPre: 50, elecOther: 100, normPre: 100, normOther: 100 }));
  const a = computeUfAnomaly("XX", serie);
  assert.equal(a.anosEleicao, 5);
  assert.equal(a.anosNormais, 5);
  assert.ok(a.idxNormal !== null && Math.abs(a.idxNormal - 1) < 1e-6, "anos normais ~1.0");
  assert.ok(a.idxEleicao !== null && a.idxEleicao < a.idxNormal, "índice de eleição menor");
  assert.ok(a.efeito !== null && a.efeito < -0.3, `efeito deve ser bem negativo (foi ${a.efeito})`);
  assert.equal(a.robusto, true); // contagem alta
});

test("efeito ~0 quando não há padrão eleitoral (série estável)", () => {
  const serie = mkSeries(cfgWith({ elecPre: 100, elecOther: 100, normPre: 100, normOther: 100 }));
  const a = computeUfAnomaly("YY", serie);
  assert.ok(a.efeito !== null && Math.abs(a.efeito) < 1e-9, `efeito ~0 (foi ${a.efeito})`);
});

test("estado de baixa contagem é marcado como não-robusto", () => {
  const baixo = computeUfAnomaly("PQ", mkSeries(cfgWith({ elecPre: 4, elecOther: 5, normPre: 5, normOther: 5 })));
  assert.equal(baixo.robusto, false); // média mensal < 30
  const alto = computeUfAnomaly("GR", mkSeries(cfgWith({ elecPre: 90, elecOther: 100, normPre: 100, normOther: 100 })));
  assert.equal(alto.robusto, true);
});

test("anos incompletos/parciais são ignorados (sem índice se faltar mês)", () => {
  const serie = mkSeries({ 2016: { pre: 50, other: 100 }, 2017: { pre: 100, other: 100 } });
  delete serie["2017-03"]; // 2017 incompleto -> ignorado
  const a = computeUfAnomaly("ZZ", serie);
  assert.equal(a.anosEleicao, 1); // só 2016
  assert.equal(a.anosNormais, 0); // 2017 caiu fora
  assert.equal(a.efeito, null); // sem par eleição×normal -> indefinido
});

test("getElectoralAnomalies: ordenado, sem BR, e CE com queda real (regressão)", () => {
  const r = getElectoralAnomalies();
  assert.ok(Array.isArray(r) && r.length >= 20, "deve cobrir as UFs");
  assert.ok(!r.some((x) => x.uf === "BR"), "BR não é unidade de análise");
  // ordenado por efeito asc (mais negativo primeiro)
  for (let i = 1; i < r.length; i++) assert.ok((r[i - 1].efeito ?? 0) <= (r[i].efeito ?? 0));
  const ce = r.find((x) => x.uf === "CE");
  assert.ok(ce && ce.efeito !== null && ce.efeito < 0, "CE tem queda pré-eleitoral real (dado oficial)");
  assert.ok(ce.robusto, "CE é estado grande -> robusto");
});
