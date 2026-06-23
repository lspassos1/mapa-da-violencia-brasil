import assert from "node:assert/strict";
import test from "node:test";

import { keywordScore, rankByRelevance } from "../src/server/osint/keywords.ts";

const art = (titulo, resumo = "", url = "https://x/" + encodeURIComponent(titulo)) => ({
  titulo, resumo, url, veiculo: "v", publicadoEm: null,
});

test("keywordScore: classifica tipo e marca arma de fogo", () => {
  const h = keywordScore(art("Homem é morto a tiros no bairro X"));
  assert.equal(h.tipo, "homicidio");
  assert.equal(h.firearm, true);
  assert.ok(h.score >= 6); // peso homicidio (4) + bônus arma (2)
});

test("keywordScore: tipo mais específico vence (feminicídio > homicídio)", () => {
  const h = keywordScore(art("Feminicídio: mulher é assassinada pelo ex"));
  assert.equal(h.tipo, "feminicidio");
});

test("keywordScore: sem sinal de crime -> null (não gasta LLM)", () => {
  assert.equal(keywordScore(art("Time vence o campeonato na final")), null);
  assert.equal(keywordScore(art("Prefeitura inaugura nova ciclovia")), null);
});

test("keywordScore: evento de tiroteio sem a palavra 'homicídio' -> homicídio", () => {
  const h = keywordScore(art("Tiroteio deixa dois mortos no centro"));
  assert.equal(h.tipo, "homicidio");
  assert.equal(h.firearm, true);
  assert.equal(h.score, 5); // SHOOTING_EVENT (3) + arma (2)
  // "a bala" (gíria) sozinha não dispara
  assert.equal(keywordScore(art("Show foi a bala, dizem fãs")), null);
});

test("rankByRelevance: empate é resolvido por URL (determinístico)", () => {
  const out = rankByRelevance([
    art("Homicídio em bairro Z", "", "https://b/2"),
    art("Homicídio em bairro Y", "", "https://a/1"),
  ]);
  assert.equal(out[0].url, "https://a/1"); // mesmo score -> URL menor primeiro
});

test("rankByRelevance: descarta não-crime e prioriza arma de fogo", () => {
  const arts = [
    art("Apreensão de drogas na rodovia"), // trafico, sem arma -> score 2
    art("Clima: previsão de chuva no fim de semana"), // descartado
    art("Tiroteio deixa dois mortos em Porto Alegre"), // homicidio+arma -> score alto
  ];
  const out = rankByRelevance(arts);
  assert.equal(out.length, 2); // clima descartado
  assert.match(out[0].titulo, /Tiroteio/); // arma de fogo primeiro
});
