import assert from "node:assert/strict";
import test from "node:test";

import { computeHiddenSignal, withNationalBaseline, getHiddenHomicides } from "../src/server/anomaly/hiddenHomicides.ts";

// serie: { ano: {homicidios, mvci, total, razaoMvci} }
function serie(pairs) {
  const s = {};
  for (const [ano, hom, mvci] of pairs) {
    const den = hom + mvci;
    s[String(ano)] = { homicidios: hom, mvci, total: hom * 20, razaoMvci: den ? Math.round((mvci / den) * 1e4) / 1e4 : null };
  }
  return s;
}

test("computeHiddenSignal: métricas cruas (homPct, razaoDelta, robustez) — sinal só vem do baseline", () => {
  const r = computeHiddenSignal("XX", serie([
    [2015, 200, 4], [2016, 205, 5], [2017, 195, 4],
    [2019, 150, 10], [2020, 148, 9], [2021, 152, 11],
  ]));
  assert.equal(r.robusto, true);
  assert.ok(r.homPct <= -0.05, `homicídio caiu (${r.homPct})`);
  assert.ok(r.razaoDelta > 0, `razão MVCI subiu (${r.razaoDelta})`);
  assert.equal(r.sinal, "neutro"); // sinal não é decidido aqui (precisa do baseline nacional)
  assert.equal(r.razaoDeltaRelativo, null);
});

test("withNationalBaseline: só vira indício quem sobe MUITO ACIMA da tendência nacional", () => {
  // 3 UFs robustas, todas com homicídio caindo. A dispara muito acima da mediana;
  // B e C acompanham a tendência -> neutras (este é o ponto: não gritar lobo).
  const rows = [
    computeHiddenSignal("A", serie([[2015, 300, 15], [2016, 300, 16], [2017, 300, 15], [2019, 200, 86], [2020, 200, 84], [2021, 200, 86]])),
    computeHiddenSignal("B", serie([[2015, 300, 15], [2016, 300, 16], [2017, 300, 15], [2019, 250, 28], [2020, 250, 27], [2021, 250, 28]])),
    computeHiddenSignal("C", serie([[2015, 300, 15], [2016, 300, 16], [2017, 300, 15], [2019, 260, 28], [2020, 260, 27], [2021, 260, 28]])),
  ];
  const out = withNationalBaseline(rows);
  const a = out.find((x) => x.uf === "A");
  const b = out.find((x) => x.uf === "B");
  assert.ok(a.razaoBaseline != null, "baseline calculado");
  assert.ok(a.razaoDeltaRelativo >= 0.03, `A acima do baseline (${a.razaoDeltaRelativo})`);
  assert.equal(a.sinal, "indicio_oculto");
  assert.equal(b.sinal, "neutro"); // acompanha a tendência nacional -> NÃO é indício
});

test("withNationalBaseline: homicídio em alta nunca vira indício (gate)", () => {
  const rows = [
    computeHiddenSignal("SOBE", serie([[2015, 100, 2], [2016, 100, 2], [2017, 100, 2], [2019, 200, 90], [2020, 200, 92], [2021, 200, 90]])),
    computeHiddenSignal("BASE", serie([[2015, 300, 15], [2016, 300, 15], [2017, 300, 15], [2019, 250, 27], [2020, 250, 27], [2021, 250, 27]])),
  ];
  const out = withNationalBaseline(rows);
  assert.equal(out.find((x) => x.uf === "SOBE").sinal, "neutro"); // homPct > 0
});

test("getHiddenHomicides: forma consistente, baseline presente quando há dados", () => {
  const out = getHiddenHomicides();
  assert.equal(out.pendente, out.ufs.length === 0);
  assert.ok(out.fonte.includes("DATASUS"));
  if (out.ufs.length > 0) {
    assert.ok(out.baseline != null, "baseline nacional definido com dados");
    for (const u of out.ufs) assert.ok(["indicio_oculto", "neutro"].includes(u.sinal));
  }
});
