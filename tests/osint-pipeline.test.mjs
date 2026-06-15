import assert from "node:assert/strict";
import test from "node:test";

import { parseRss } from "../src/server/osint/rss.ts";
import { normalizeName, geocode } from "../src/server/osint/geocode.ts";
import { runPipeline } from "../src/server/osint/pipeline.ts";

const NOW = () => "2026-06-14T00:00:00.000Z";

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

test("parseRss usa <source> como veiculo e remove o sufixo do titulo", () => {
  const xml = `<rss><channel>
    <item><title>Crime em Recife - G1</title><link>https://g.co/1</link>
      <description>x</description><source url="https://g1.globo.com">G1</source></item>
    <item><title>Outro caso</title><link>https://g.co/2</link><description>y</description></item>
  </channel></rss>`;
  const arts = parseRss(xml, "Google Notícias");
  assert.equal(arts[0].veiculo, "G1"); // <source> sobrepoe o fallback
  assert.equal(arts[0].titulo, "Crime em Recife"); // sufixo " - G1" removido
  assert.equal(arts[1].veiculo, "Google Notícias"); // fallback quando sem <source>
});

// Extrator falso, deterministico (sem rede): classifica por conteudo do artigo.
function maceioExtractor(conf = 0.9) {
  return async (a) => {
    if (a.titulo.startsWith("Opinião")) {
      return { provedor: "fake", extraction: { ehCrimeViolento: false, tipo: "outro", municipio: null, uf: null, vitimas: null, dataOcorrencia: null, confianca: 0.2, resumo: "" } };
    }
    return { provedor: "fake", extraction: { ehCrimeViolento: true, tipo: "homicidio", municipio: "Maceió", uf: "AL", vitimas: 1, dataOcorrencia: a.publicadoEm ? a.publicadoEm.slice(0, 10) : null, confianca: conf, resumo: a.resumo } };
  };
}

test("pipeline: descarta nao-crime, geocodifica e funde dois veiculos do mesmo caso", async () => {
  const articles = [
    { titulo: "Homicídio a tiros em Maceió", resumo: "vítima morta a tiros no centro", url: "https://veiculo-a.com/1", publicadoEm: "2026-06-10T00:00:00.000Z", veiculo: "A" },
    { titulo: "Homicídio em Maceió deixa morto", resumo: "homem morto a tiros em Maceió", url: "https://veiculo-b.com/2", publicadoEm: "2026-06-10T00:00:00.000Z", veiculo: "B" },
    { titulo: "Opinião sobre política", resumo: "editorial", url: "https://veiculo-c.com/3", publicadoEm: null, veiculo: "C" },
  ];
  const { incidents, stats } = await runPipeline(articles, { extractor: maceioExtractor(0.9), now: NOW });

  assert.equal(stats.artigos, 3);
  assert.equal(stats.extraidos, 2); // 2 crimes
  assert.equal(stats.descartados, 1); // 1 opiniao
  assert.equal(incidents.length, 1); // os 2 crimes (mesmo caso) deduplicados
  const inc = incidents[0];
  assert.equal(inc.tipo, "homicidio");
  assert.equal(inc.uf, "AL");
  assert.equal(inc.idIbge, "2704302"); // Maceió
  assert.equal(inc.fontes.length, 2); // ambos os veiculos preservados
  assert.equal(inc.corroboracao, 2); // hostnames distintos
  assert.equal(inc.reviewStatus, "confirmado"); // confianca alta + geocoded
  assert.equal(typeof inc.lat, "number");
});

test("acceptance: mesma ocorrencia de 3 veiculos vira 1 incidente com 3 fontes", async () => {
  const articles = [
    { titulo: "Homicídio a tiros em Maceió deixa um morto", resumo: "homem morto a tiros em Maceió", url: "https://g1.com/x", publicadoEm: "2026-06-10T00:00:00.000Z", veiculo: "G1" },
    { titulo: "Homicídio em Maceió: homem é morto a tiros", resumo: "vítima morta a tiros em Maceió", url: "https://cnn.com/y", publicadoEm: "2026-06-11T00:00:00.000Z", veiculo: "CNN" },
    { titulo: "Tiros em Maceió deixam um homem morto", resumo: "homicídio com um morto em Maceió", url: "https://folha.com/z", publicadoEm: "2026-06-12T00:00:00.000Z", veiculo: "Folha" },
  ];
  const { incidents } = await runPipeline(articles, { extractor: maceioExtractor(0.6), now: NOW });

  assert.equal(incidents.length, 1);
  const inc = incidents[0];
  assert.equal(inc.fontes.length, 3);
  assert.equal(inc.corroboracao, 3);
  assert.equal(new Set(inc.fontes.map((f) => f.veiculo)).size, 3); // 3 veiculos distintos
  assert.ok(Math.abs(inc.confianca - 0.8) < 1e-9); // 0.6 + 0.1*(3-1)
  assert.equal(inc.reviewStatus, "confirmado"); // 0.8 >= 0.75 e geocoded
});

test("acceptance: baixa confianca nao vira confirmado sem revisao", async () => {
  // (i) geocodificado mas confianca abaixo do limiar -> pendente
  const geoLow = await runPipeline(
    [{ titulo: "Roubo em Maceió", resumo: "x", url: "https://a.com/1", publicadoEm: "2026-06-10T00:00:00.000Z", veiculo: "A" }],
    { extractor: async (a) => ({ provedor: "fake", extraction: { ehCrimeViolento: true, tipo: "roubo", municipio: "Maceió", uf: "AL", vitimas: null, dataOcorrencia: "2026-06-10", confianca: 0.5, resumo: a.resumo } }), now: NOW },
  );
  assert.equal(geoLow.incidents[0].reviewStatus, "pendente");

  // (ii) sem geocoding rebaixa confianca (<=0.4) e marca pendente, mesmo conf alta
  const ungeo = await runPipeline(
    [{ titulo: "Crime em local inexistente", resumo: "x", url: "https://a.com/9", publicadoEm: null, veiculo: "A" }],
    { extractor: async () => ({ provedor: "fake", extraction: { ehCrimeViolento: true, tipo: "roubo", municipio: "Cidade Inventada XYZ", uf: "ZZ", vitimas: null, dataOcorrencia: null, confianca: 0.95, resumo: "x" } }), now: NOW },
  );
  assert.equal(ungeo.incidents.length, 1);
  assert.equal(ungeo.incidents[0].idIbge, null);
  assert.ok(ungeo.incidents[0].confianca <= 0.4);
  assert.equal(ungeo.incidents[0].reviewStatus, "pendente");
});

test("pipeline: corroboracao NAO eleva item sem geo a confirmavel", async () => {
  // Dois veiculos do mesmo caso, mas municipio nao mapeavel -> cap 0.4 + pendente.
  const articles = [
    { titulo: "Homicídio a tiros em Xanadu deixa morto", resumo: "homem morto a tiros em Xanadu", url: "https://a.com/1", publicadoEm: "2026-06-10T00:00:00.000Z", veiculo: "A" },
    { titulo: "Homicídio em Xanadu: homem morto a tiros", resumo: "vítima morta a tiros em Xanadu", url: "https://b.com/2", publicadoEm: "2026-06-10T00:00:00.000Z", veiculo: "B" },
  ];
  const { incidents } = await runPipeline(articles, {
    extractor: async (a) => ({ provedor: "fake", extraction: { ehCrimeViolento: true, tipo: "homicidio", municipio: "Xanadu", uf: "ZZ", vitimas: 1, dataOcorrencia: "2026-06-10", confianca: 0.9, resumo: a.resumo } }),
    now: NOW,
  });
  assert.equal(incidents.length, 1);
  assert.equal(incidents[0].idIbge, null);
  assert.ok(incidents[0].confianca <= 0.4);
  assert.equal(incidents[0].reviewStatus, "pendente");
});

test("pipeline: crimes distintos na mesma cidade/dia NAO sao mesclados (anti over-merge)", async () => {
  const articles = [
    { titulo: "Homicídio a tiros no Centro de Maceió", resumo: "homem morto durante assalto a banco", url: "https://a.com/1", publicadoEm: "2026-06-10T00:00:00.000Z", veiculo: "A" },
    { titulo: "Homicídio em bairro de Maceió após briga de trânsito", resumo: "vítima atropelada e espancada na zona rural", url: "https://b.com/2", publicadoEm: "2026-06-10T00:00:00.000Z", veiculo: "B" },
  ];
  const { incidents } = await runPipeline(articles, { extractor: maceioExtractor(0.9), now: NOW });
  assert.equal(incidents.length, 2); // mesmo tipo/municipio/dia, textos dissimilares
});

test("pipeline: ocorrencias sem-geo em cidades distintas NAO colam por vocabulario de crime", async () => {
  // Bucket ungeo (so por tipo): vocabulario generico (morto/tiros/homem) e
  // stopword, entao so o local (Xanadu vs Zorpia) discrimina -> nao mescla.
  const articles = [
    { titulo: "Homem morto a tiros em Xanadu", resumo: "vítima morta a tiros", url: "https://a.com/1", publicadoEm: "2026-06-10T00:00:00.000Z", veiculo: "A" },
    { titulo: "Homem morto a tiros em Zorpia", resumo: "vítima morta a tiros", url: "https://b.com/2", publicadoEm: "2026-06-10T00:00:00.000Z", veiculo: "B" },
  ];
  const { incidents } = await runPipeline(articles, {
    extractor: async (a) => ({ provedor: "fake", extraction: { ehCrimeViolento: true, tipo: "homicidio", municipio: a.titulo.includes("Xanadu") ? "Xanadu" : "Zorpia", uf: "ZZ", vitimas: 1, dataOcorrencia: "2026-06-10", confianca: 0.9, resumo: a.resumo } }),
    now: NOW,
  });
  assert.equal(incidents.length, 2); // crimes distintos (cidades diferentes) nao colapsados
});

test("acceptance: reexecucao em ordem diferente e idempotente", async () => {
  const articles = [
    { titulo: "Homicídio a tiros em Maceió deixa um morto", resumo: "homem morto a tiros em Maceió", url: "https://g1.com/x", publicadoEm: "2026-06-10T00:00:00.000Z", veiculo: "G1" },
    { titulo: "Homicídio em Maceió: homem é morto a tiros", resumo: "vítima morta a tiros em Maceió", url: "https://cnn.com/y", publicadoEm: "2026-06-11T00:00:00.000Z", veiculo: "CNN" },
    { titulo: "Tiros em Maceió deixam um homem morto", resumo: "homicídio com um morto em Maceió", url: "https://folha.com/z", publicadoEm: "2026-06-12T00:00:00.000Z", veiculo: "Folha" },
  ];
  const r1 = await runPipeline(articles, { extractor: maceioExtractor(0.6), now: NOW });
  const r2 = await runPipeline([...articles].reverse(), { extractor: maceioExtractor(0.6), now: NOW });
  assert.deepEqual(r2.incidents, r1.incidents); // mesmos ids, fontes ordenadas, confianca
});

test("pipeline: fonte primaria e a de maior confianca (desempate por url)", async () => {
  const articles = [
    { titulo: "Homicídio em Maceió: homem morto a tiros", resumo: "vítima morta a tiros em Maceió", url: "https://low.com/2", publicadoEm: "2026-06-10T00:00:00.000Z", veiculo: "Baixa" },
    { titulo: "Homicídio a tiros em Maceió deixa morto", resumo: "homem morto a tiros em Maceió", url: "https://high.com/1", publicadoEm: "2026-06-10T00:00:00.000Z", veiculo: "Alta" },
  ];
  // confianca depende da URL (high=0.9, low=0.6) -> primaria deve ser a "Alta".
  const { incidents } = await runPipeline(articles, {
    extractor: async (a) => ({ provedor: "fake", extraction: { ehCrimeViolento: true, tipo: "homicidio", municipio: "Maceió", uf: "AL", vitimas: 1, dataOcorrencia: "2026-06-10", confianca: a.url.includes("high") ? 0.9 : 0.6, resumo: a.resumo } }),
    now: NOW,
  });
  assert.equal(incidents.length, 1);
  assert.equal(incidents[0].veiculo, "Alta");
  assert.equal(incidents[0].fonteUrl, "https://high.com/1");
  assert.equal(incidents[0].fontes[0].confianca, 0.9);
});
