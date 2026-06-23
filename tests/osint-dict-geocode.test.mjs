import assert from "node:assert/strict";
import test from "node:test";

import { geocodeFromText } from "../src/server/osint/geocode.ts";
import { createHybridExtractor } from "../src/server/osint/hybridExtractor.ts";

const art = (titulo, resumo = "") => ({ titulo, resumo, url: "https://x/" + encodeURIComponent(titulo), veiculo: "v", publicadoEm: "2026-06-20T10:00:00Z" });

test("geocodeFromText: capital no texto -> resolve", () => {
  const m = geocodeFromText("Tiroteio deixa dois mortos em Belo Horizonte");
  assert.equal(m?.uf, "MG");
  assert.equal(m?.municipio, "Belo Horizonte");
  assert.equal(geocodeFromText("Homem é baleado em Porto Alegre")?.uf, "RS");
});

test("geocodeFromText: guarda contra 'interior/região' (não é o local do fato)", () => {
  assert.equal(geocodeFromText("Crime no interior de São Paulo"), null);
  assert.equal(geocodeFromText("Operação na região de Salvador"), null);
});

test("geocodeFromText: capitais ambíguas (Natal/Vitória) NÃO disparam", () => {
  assert.equal(geocodeFromText("Festa de Natal reúne famílias na praça"), null);
  assert.equal(geocodeFromText("Time comemora a vitória no campeonato"), null);
});

test("geocodeFromText: nome único multi-palavra resolve; texto genérico não", () => {
  assert.ok(geocodeFromText("Homicídio registrado em Feira de Santana")); // único no BR
  assert.equal(geocodeFromText("Reunião ocorreu na prefeitura municipal"), null);
});

test("createHybridExtractor: não-crime descarta sem LLM", async () => {
  let llmCalls = 0;
  const ex = createHybridExtractor(5, async () => { llmCalls++; return null; });
  const r = await ex(art("Time vence o campeonato"));
  assert.equal(r.extraction.ehCrimeViolento, false);
  assert.equal(r.provedor, "keyword");
  assert.equal(llmCalls, 0);
});

test("createHybridExtractor: crime + capital -> dicionário, sem LLM", async () => {
  let llmCalls = 0;
  const ex = createHybridExtractor(5, async () => { llmCalls++; return null; });
  const r = await ex(art("Tiroteio deixa um morto em Curitiba"));
  assert.equal(r.provedor, "keyword+dict");
  assert.equal(r.extraction.uf, "PR");
  assert.equal(r.extraction.ehCrimeViolento, true);
  assert.equal(llmCalls, 0); // não gastou LLM
});

test("createHybridExtractor: crime sem geo -> LLM até o orçamento, depois para", async () => {
  let llmCalls = 0;
  const ex = createHybridExtractor(1, async () => { llmCalls++; return { extraction: { ehCrimeViolento: true, tipo: "homicidio", municipio: "X", uf: "ZZ", vitimas: null, dataOcorrencia: null, confianca: 0.8, resumo: "" }, provedor: "llm" }; });
  const semGeo = art("Homem é assassinado em local não identificado da cidade");
  const a = await ex(semGeo);
  assert.equal(a.provedor, "llm");
  const b = await ex(semGeo); // orçamento esgotado
  assert.equal(b, null);
  assert.equal(llmCalls, 1);
});
