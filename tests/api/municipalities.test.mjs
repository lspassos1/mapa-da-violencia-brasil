import assert from "node:assert/strict";
import test from "node:test";

import { GET as crimeMapGET } from "../../src/app/api/crime-map/route.ts";
import { GET as municipalityGET } from "../../src/app/api/municipalities/[idIbge]/route.ts";

function callMunicipality(idIbge, query = "") {
  return municipalityGET(new Request(`http://localhost/api/municipalities/${idIbge}${query}`), {
    params: Promise.resolve({ idIbge }),
  });
}

test("retorna 404 para municipio inexistente", async () => {
  const res = await callMunicipality("0000000");
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.ok(body.error, "deve devolver mensagem de erro");
});

test("retorna 404 para id nao numerico", async () => {
  const res = await callMunicipality("nao-existe");
  assert.equal(res.status, 404);
});

test("retorna 200 com a forma esperada para um municipio valido", async () => {
  const map = await (await crimeMapGET(new Request("http://localhost/api/crime-map"))).json();
  const sample = map.items[0];
  if (!sample) return; // dataset vazio: nada a verificar

  const res = await callMunicipality(sample.idIbge, `?periodo=${sample.periodo}`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.item, "deve incluir o municipio");
  assert.equal(body.item.idIbge, sample.idIbge);
  assert.ok(body.status, "deve incluir status");
  assert.equal(typeof body.demo, "boolean");
});
