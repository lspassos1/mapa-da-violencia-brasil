import assert from "node:assert/strict";
import test from "node:test";

import { tokenize, articleTokens, jaccard } from "../src/server/osint/similarity.ts";

test("tokenize remove stopwords, acentos, caixa e tokens curtos", () => {
  const t = tokenize("A vítima foi morta em São Paulo");
  assert.ok(t.has("sao")); // local discrimina -> fica
  assert.ok(t.has("paulo"));
  assert.ok(!t.has("a")); // curto + stopword
  assert.ok(!t.has("em")); // stopword conectivo
  assert.ok(!t.has("foi")); // stopword conectivo
  assert.ok(!t.has("vitima")); // vocabulario generico de crime -> stopword
  assert.ok(!t.has("morta")); // idem
});

test("jaccard: identidade=1, disjunto=0, parcial calculado", () => {
  const a = new Set(["x", "y", "z"]);
  assert.equal(jaccard(a, new Set(["x", "y", "z"])), 1);
  assert.equal(jaccard(a, new Set(["p", "q"])), 0);
  // inter {x,y}=2, union {x,y,z,w}=4 -> 0.5
  assert.equal(jaccard(new Set(["x", "y", "z"]), new Set(["x", "y", "w"])), 0.5);
});

test("jaccard e simetrico", () => {
  const a = articleTokens("Homicídio em Maceió", "homem morto a tiros");
  const b = articleTokens("Tiros em Maceió deixam morto", "homicídio na capital");
  assert.equal(jaccard(a, b), jaccard(b, a));
});

test("manchetes do mesmo evento >= SIM_LOW; crimes distintos < SIM_LOW", () => {
  const SIM_LOW = 0.3;
  const ev1 = articleTokens("Homicídio a tiros em Maceió deixa um morto", "homem morto a tiros");
  const ev2 = articleTokens("Homem é morto a tiros em Maceió", "homicídio na capital alagoana");
  assert.ok(jaccard(ev1, ev2) >= SIM_LOW);
  const other = articleTokens("Feminicídio em Recife", "mulher esfaqueada pelo ex em Pernambuco");
  assert.ok(jaccard(ev1, other) < SIM_LOW);
});
