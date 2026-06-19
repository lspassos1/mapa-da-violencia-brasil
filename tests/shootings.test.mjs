import assert from "node:assert/strict";
import test from "node:test";

import { classifyContexto, mapOccurrence, aggregateByMunicipio } from "../src/server/shootings/fogocruzado.ts";

test("classifyContexto: disputa / polícia / outro", () => {
  assert.equal(classifyContexto("Disputa", false), "disputa");
  assert.equal(classifyContexto("Operação policial", false), "policia");
  assert.equal(classifyContexto("Ação policial", false), "policia");
  assert.equal(classifyContexto("Homicidio/Tentativa", true), "policia"); // policeAction domina
  assert.equal(classifyContexto("Homicidio/Tentativa", false), "outro");
  assert.equal(classifyContexto(null, false), "outro");
});

test("mapOccurrence: extrai campos, contexto e vítimas", () => {
  const raw = {
    id: "abc-1",
    date: "2025-09-01T06:30:00.000Z",
    latitude: "-22.86",
    longitude: "-43.34",
    policeAction: false,
    state: { name: "Rio de Janeiro" },
    city: { name: "São Gonçalo" },
    neighborhood: { name: "Centro" },
    contextInfo: { mainReason: { name: "Disputa" } },
    victims: [
      { type: "People", situation: "Dead" },
      { type: "People", situation: "Wounded" },
      { type: "People", situation: "Wounded" },
      { type: "Animal", situation: "Dead" }, // ignorado
    ],
  };
  const o = mapOccurrence(raw);
  assert.equal(o.id, "abc-1");
  assert.equal(o.estado, "Rio de Janeiro");
  assert.equal(o.municipio, "São Gonçalo");
  assert.equal(o.bairro, "Centro");
  assert.equal(o.contexto, "disputa");
  assert.equal(o.mortos, 1);
  assert.equal(o.feridos, 2);
  assert.equal(o.lat, -22.86);
  assert.equal(o.lng, -43.34);
});

test("mapOccurrence: lat/lng inválidos viram null", () => {
  const o = mapOccurrence({ id: "x", latitude: "", longitude: null, victims: [] });
  assert.equal(o.lat, null);
  assert.equal(o.lng, null);
  assert.equal(o.mortos, 0);
});

test("aggregateByMunicipio: soma por município, ordena por total, calcula share", () => {
  const occ = [
    { municipio: "Rio de Janeiro", estado: "Rio de Janeiro", contexto: "disputa", mortos: 1, feridos: 0 },
    { municipio: "Rio de Janeiro", estado: "Rio de Janeiro", contexto: "policia", mortos: 0, feridos: 2 },
    { municipio: "Rio de Janeiro", estado: "Rio de Janeiro", contexto: "outro", mortos: 1, feridos: 0 },
    { municipio: "Salvador", estado: "Bahia", contexto: "disputa", mortos: 2, feridos: 1 },
  ];
  const rows = aggregateByMunicipio(occ);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].municipio, "Rio de Janeiro"); // maior total primeiro
  assert.equal(rows[0].total, 3);
  assert.equal(rows[0].disputa, 1);
  assert.equal(rows[0].policia, 1);
  assert.equal(rows[0].mortos, 2);
  assert.equal(rows[0].disputaShare, 0.333); // arredondado a 3 casas
  assert.equal(rows[1].municipio, "Salvador");
  assert.equal(rows[1].mortos, 2);
});
