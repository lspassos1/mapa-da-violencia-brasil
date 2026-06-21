import assert from "node:assert/strict";
import test from "node:test";

import { computeUfAnomaly, getElectoralAnomalies, withPeerBaselines, classifyPorte, ELECTION_YEARS } from "../src/server/anomaly/electoralCycle.ts";

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

test("getElectoralAnomalies: ordenado por efeito vs pares, sem BR, e CE com queda real (regressão)", () => {
  const r = getElectoralAnomalies();
  assert.ok(Array.isArray(r) && r.length >= 20, "deve cobrir as UFs");
  assert.ok(!r.some((x) => x.uf === "BR"), "BR não é unidade de análise");
  // ordenado por efeitoRelativo asc (mais negativo que os pares primeiro)
  for (let i = 1; i < r.length; i++) assert.ok((r[i - 1].efeitoRelativo ?? 0) <= (r[i].efeitoRelativo ?? 0));
  const ce = r.find((x) => x.uf === "CE");
  assert.ok(ce && ce.efeito !== null && ce.efeito < 0, "CE tem queda pré-eleitoral real (dado oficial)");
  assert.ok(ce.robusto, "CE é estado grande -> robusto");
  assert.ok(ce.efeitoRelativo !== null && ce.efeitoBaseline !== null, "CE tem baseline e efeito relativo");
  assert.equal(ce.porte, "grande");
});

test("classifyPorte: cortes por volume mensal", () => {
  assert.equal(classifyPorte(425), "grande");
  assert.equal(classifyPorte(200), "grande");
  assert.equal(classifyPorte(150), "medio");
  assert.equal(classifyPorte(100), "medio");
  assert.equal(classifyPorte(60), "pequeno");
  assert.equal(classifyPorte(30), "pequeno");
  assert.equal(classifyPorte(29), "micro");
});

test("withPeerBaselines: efeitoRelativo = efeito − mediana dos pares de mesmo porte (DiD)", () => {
  // 3 UFs grandes robustas: efeitos -0.30, -0.10, -0.10. Para A, pares=[-0.10,-0.10]
  // -> mediana -0.10 -> relativo = -0.30 - (-0.10) = -0.20. (B e C teriam pares
  // [-0.30,-0.10] -> mediana -0.20 -> relativo +0.10.)
  const mk = (uf, efeito) => ({
    uf, idxEleicao: null, idxNormal: null, efeito, mediaMensal: 300,
    porte: "grande", efeitoBaseline: null, efeitoRelativo: null,
    anosEleicao: 5, anosNormais: 5, robusto: true,
  });
  const out = withPeerBaselines([mk("A", -0.3), mk("B", -0.1), mk("C", -0.1)]);
  const a = out.find((x) => x.uf === "A");
  assert.equal(a.efeitoBaseline, -0.1);
  assert.equal(a.efeitoRelativo, -0.2);
});

test("withPeerBaselines: com menos de 2 pares no porte, recai na mediana nacional", () => {
  const base = (uf, efeito, porte, mm) => ({
    uf, idxEleicao: null, idxNormal: null, efeito, mediaMensal: mm,
    porte, efeitoBaseline: null, efeitoRelativo: null,
    anosEleicao: 5, anosNormais: 5, robusto: true,
  });
  // só 1 UF 'medio' (solitária) + 3 'grandes' -> baseline da médio = mediana nacional
  const out = withPeerBaselines([
    base("M", -0.2, "medio", 120),
    base("G1", -0.1, "grande", 300),
    base("G2", 0.0, "grande", 300),
    base("G3", 0.1, "grande", 300),
  ]);
  const m = out.find((x) => x.uf === "M");
  // mediana nacional dos robustos [-0.2,-0.1,0,0.1] = (-0.1+0)/2 = -0.05
  assert.equal(m.efeitoBaseline, -0.05);
  assert.equal(m.efeitoRelativo, -0.15);
});
