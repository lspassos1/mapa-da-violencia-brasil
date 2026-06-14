import assert from "node:assert/strict";
import test from "node:test";

import { parseRss } from "../src/server/osint/rss.ts";
import { normalizeName, geocode } from "../src/server/osint/geocode.ts";
import { runPipeline } from "../src/server/osint/pipeline.ts";

test("normalizeName remove acentos, caixa e pontuacao", () => {
  assert.equal(normalizeName("São Paulo"), "sao paulo");
  assert.equal(normalizeName("  MOGI-GUAÇU "), "mogi guacu");
});

test("geocode resolve municipio+uf para IBGE e centroide", () => {
  const sp = geocode("São Paulo", "SP");
  assert.equal(sp?.idIbge, "3550308");
  assert.equal(typeof sp?.lat, "number");
  const rj = geocode("Rio de Janeiro", "RJ");
  assert.equal(rj?.idIbge, "3304557");
});

test("geocode sem UF nao resolve nome ambiguo", () => {
  // "Bom Jesus" existe em varias UFs -> ambiguo -> null sem UF.
  assert.equal(geocode("Bom Jesus", null), null);
});

test("parseRss extrai itens (titulo, link, descricao)", () => {
  const xml = `<rss><channel>
    <item><title>Homem é morto a tiros em Maceió</title><link>https://ex.com/1</link>
      <description><![CDATA[Ocorrência na capital alagoana.]]></description>
      <pubDate>Wed, 10 Jun 2026 12:00:00 GMT</pubDate></item>
    <item><title>Opinião: segurança pública</title><link>https://ex.com/2</link>
      <description>Artigo de opinião</description></item>
  </channel></rss>`;
  const arts = parseRss(xml, "Veículo X");
  assert.equal(arts.length, 2);
  assert.equal(arts[0].titulo, "Homem é morto a tiros em Maceió");
  assert.equal(arts[0].url, "https://ex.com/1");
  assert.equal(arts[0].veiculo, "Veículo X");
});

test("pipeline: descarta nao-crime, geocodifica e deduplica", async () => {
  const articles = [
    { titulo: "Homicídio em Maceió", resumo: "vítima morta a tiros", url: "https://a.com/1", publicadoEm: "2026-06-10T00:00:00.000Z", veiculo: "A" },
    { titulo: "Mesmo caso, outro veículo", resumo: "homem morto em Maceió", url: "https://a.com/2", publicadoEm: "2026-06-10T00:00:00.000Z", veiculo: "B" },
    { titulo: "Opinião sobre política", resumo: "editorial", url: "https://a.com/3", publicadoEm: null, veiculo: "C" },
  ];
  // extrator falso: deterministico, sem rede.
  const fakeExtractor = async (a) => {
    if (a.titulo.startsWith("Opinião")) {
      return { provedor: "fake", extraction: { ehCrimeViolento: false, tipo: "outro", municipio: null, uf: null, vitimas: null, dataOcorrencia: null, confianca: 0.2, resumo: "" } };
    }
    return { provedor: "fake", extraction: { ehCrimeViolento: true, tipo: "homicidio", municipio: "Maceió", uf: "AL", vitimas: 1, dataOcorrencia: "2026-06-10", confianca: 0.9, resumo: a.resumo } };
  };
  const { incidents, stats } = await runPipeline(articles, { extractor: fakeExtractor, now: () => "2026-06-14T00:00:00.000Z" });

  assert.equal(stats.artigos, 3);
  assert.equal(stats.extraidos, 2); // 2 crimes
  assert.equal(stats.descartados, 1); // 1 opiniao
  assert.equal(incidents.length, 1); // os 2 crimes (mesmo caso) deduplicados
  const inc = incidents[0];
  assert.equal(inc.tipo, "homicidio");
  assert.equal(inc.uf, "AL");
  assert.equal(inc.idIbge, "2704302"); // Maceió
  assert.equal(inc.reviewStatus, "confirmado"); // confianca 0.9 + geocoded
  assert.equal(typeof inc.lat, "number");
});

test("pipeline: sem geocoding rebaixa confianca e marca pendente", async () => {
  const articles = [
    { titulo: "Crime em local inexistente", resumo: "x", url: "https://a.com/9", publicadoEm: null, veiculo: "A" },
  ];
  const fakeExtractor = async () => ({
    provedor: "fake",
    extraction: { ehCrimeViolento: true, tipo: "roubo", municipio: "Cidade Inventada XYZ", uf: "ZZ", vitimas: null, dataOcorrencia: null, confianca: 0.95, resumo: "x" },
  });
  const { incidents } = await runPipeline(articles, { extractor: fakeExtractor, now: () => "2026-06-14T00:00:00.000Z" });
  assert.equal(incidents.length, 1);
  assert.equal(incidents[0].idIbge, null);
  assert.ok(incidents[0].confianca <= 0.4);
  assert.equal(incidents[0].reviewStatus, "pendente");
});
