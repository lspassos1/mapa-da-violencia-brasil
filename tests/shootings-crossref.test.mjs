import assert from "node:assert/strict";
import test from "node:test";

import { ehViolenciaArmada, groupNoticiasByMunicipio } from "../src/server/shootings/crossref.ts";

function inc(municipio, data, titulo, extra = {}) {
  return {
    tipo: "homicidio",
    municipio,
    uf: "RJ",
    dataOcorrencia: data,
    resumo: `resumo ${titulo}`,
    veiculo: "G1",
    fonteUrl: `https://ex/${titulo}`,
    fontes: [{ titulo, veiculo: "G1", fonteUrl: `https://ex/${titulo}`, provedor: "x", confianca: 0.8, publicadoEm: null }],
    ...extra,
  };
}

test("groupNoticiasByMunicipio: agrupa por município normalizado (casing/acento)", () => {
  const map = groupNoticiasByMunicipio([
    inc("Rio de Janeiro", "2026-06-10", "a"),
    inc("RIO DE JANEIRO", "2026-06-12", "b"),
    inc("Niterói", "2026-06-11", "c"),
  ]);
  assert.equal(map.size, 2);
  assert.equal(map.get("rio de janeiro").length, 2);
  assert.equal(map.get("niteroi").length, 1);
});

test("groupNoticiasByMunicipio: ordena por data desc e mapeia a referência", () => {
  const refs = groupNoticiasByMunicipio([
    inc("Recife", "2026-06-01", "antiga"),
    inc("Recife", "2026-06-09", "nova"),
  ]).get("recife");
  assert.equal(refs[0].titulo, "nova"); // mais recente primeiro
  assert.equal(refs[1].titulo, "antiga");
  assert.equal(refs[0].veiculo, "G1");
  assert.equal(refs[0].url, "https://ex/nova");
  assert.equal(refs[0].tipo, "homicidio");
});

test("groupNoticiasByMunicipio: respeita o cap por município e ignora sem município", () => {
  const items = Array.from({ length: 8 }, (_, i) => inc("Salvador", `2026-06-0${i + 1}`, `t${i}`));
  items.push(inc("", "2026-06-10", "semMun")); // ignorado
  const map = groupNoticiasByMunicipio(items, 3);
  assert.equal(map.get("salvador").length, 3);
  assert.equal(map.has(""), false);
});

// tipo letal entra direto; o texto entra só com forma de disparo/arma de fogo.
const armado = (tipo, resumo, titulo = "") => ehViolenciaArmada({ tipo, resumo, fontes: [{ titulo }] });

test("ehViolenciaArmada: tipo letal é sempre violência armada", () => {
  assert.equal(armado("homicidio", "sem detalhes"), true);
  assert.equal(armado("latrocinio", ""), true);
  assert.equal(armado("feminicidio", ""), true);
});

test("ehViolenciaArmada: pega disparo/baleado/tiroteio no texto", () => {
  assert.equal(armado("roubo", "vítima foi baleada na perna"), true);
  assert.equal(armado("outro", "morto a tiros em via pública"), true);
  assert.equal(armado("outro", "houve tiroteio entre grupos"), true);
  assert.equal(armado("outro", "policial fez disparos de fuzil"), true);
  assert.equal(armado("outro", "neutro", "vítima atingida a tiro"), true); // título também conta
});

test("ehViolenciaArmada: arma usada em roubo (sem apreensão) é violência armada", () => {
  // Greptile #132: não excluir roubo à mão armada só porque cita "pistola".
  assert.equal(armado("roubo", "assaltante rendeu a vítima com pistola"), true);
  assert.equal(armado("outro", "dupla armada de revólver invadiu a casa"), true);
});

test("ehViolenciaArmada: NÃO confunde esporte/apreensão (tiro/pistola soltos)", () => {
  assert.equal(armado("outro", "campeonato de tiro esportivo no clube"), false);
  assert.equal(armado("outro", "atleta treina tiro ao alvo"), false);
  assert.equal(armado("outro", "apreensão de pistola em blitz de trânsito"), false);
  assert.equal(armado("outro", "PM recolhe revólver entregue por morador"), false);
});
