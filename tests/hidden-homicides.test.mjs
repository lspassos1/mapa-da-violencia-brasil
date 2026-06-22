import assert from "node:assert/strict";
import test from "node:test";

import { computeHiddenSignal, getHiddenHomicides } from "../src/server/anomaly/hiddenHomicides.ts";

// serie: { ano: {homicidios, mvci, total, razaoMvci} }
function serie(pairs) {
  const s = {};
  for (const [ano, hom, mvci] of pairs) {
    const den = hom + mvci;
    s[String(ano)] = { homicidios: hom, mvci, total: hom * 20, razaoMvci: den ? Math.round((mvci / den) * 1e4) / 1e4 : null };
  }
  return s;
}

test("computeHiddenSignal: assinatura de ouro (homicídio cai E razão MVCI sobe)", () => {
  // 1ª metade ~200 hom / razão ~0.02; 2ª metade ~150 hom / razão ~0.06
  const r = computeHiddenSignal("XX", serie([
    [2015, 200, 4], [2016, 205, 5], [2017, 195, 4],
    [2019, 150, 10], [2020, 148, 9], [2021, 152, 11],
  ]));
  assert.equal(r.robusto, true);
  assert.ok(r.homPct <= -0.05, `homicídio caiu (${r.homPct})`);
  assert.ok(r.razaoDelta > 0, `razão MVCI subiu (${r.razaoDelta})`);
  assert.equal(r.sinal, "indicio_oculto");
});

test("computeHiddenSignal: estável -> neutro", () => {
  const r = computeHiddenSignal("YY", serie([
    [2015, 200, 6], [2016, 200, 6], [2017, 200, 6],
    [2019, 200, 6], [2020, 200, 6], [2021, 200, 6],
  ]));
  assert.equal(r.sinal, "neutro");
});

test("computeHiddenSignal: poucos anos -> não robusto, neutro", () => {
  const r = computeHiddenSignal("ZZ", serie([[2015, 300, 2], [2016, 100, 20], [2017, 90, 25]]));
  assert.equal(r.robusto, false);
  assert.equal(r.sinal, "neutro");
});

test("computeHiddenSignal: baixo volume -> não robusto mesmo com padrão", () => {
  const r = computeHiddenSignal("WW", serie([
    [2015, 30, 1], [2016, 28, 1], [2017, 32, 1],
    [2019, 10, 5], [2020, 9, 6], [2021, 11, 5],
  ]));
  assert.equal(r.robusto, false); // homInicial < 50
  assert.equal(r.sinal, "neutro");
});

// Resiliente ao asset estar VAZIO (placeholder) ou CHEIO (após o ETL) — não
// quebra o CI quando o hiddenHomicides.json real for commitado.
test("getHiddenHomicides: forma consistente independente do estado do asset", () => {
  const out = getHiddenHomicides();
  assert.equal(out.pendente, out.ufs.length === 0); // pendente sse não há UFs
  assert.ok(out.fonte.includes("DATASUS"));
  for (const u of out.ufs) {
    assert.equal(typeof u.uf, "string");
    assert.ok(["indicio_oculto", "neutro"].includes(u.sinal));
  }
});
