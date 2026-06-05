import assert from "node:assert/strict";
import test from "node:test";

import { GET as crimeMapGET } from "../../src/app/api/crime-map/route.ts";
import { GET as metadataGET } from "../../src/app/api/metadata/route.ts";

function call(query = "") {
  return crimeMapGET(new Request(`http://localhost/api/crime-map${query}`));
}

async function metadata() {
  return (await metadataGET().json());
}

test("responde 200 com a forma esperada do payload", async () => {
  const res = call();
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.items), "items deve ser array");
  assert.ok(Array.isArray(body.ranking), "ranking deve ser array");
  assert.ok(body.metadata, "deve incluir metadata");
  assert.ok(body.filters, "deve incluir filters");
  assert.ok(body.fonteResumo, "deve incluir fonteResumo");
  // espelhos pt-BR dos filtros resolvidos
  assert.equal(body.indicador, body.filters.indicator);
  assert.equal(body.periodo, body.filters.period);
  assert.equal(body.modo, body.filters.viewMode);
});

test("aceita 'indicador' (pt) e 'indicator' (en) como sinonimos", async () => {
  const { indicadores } = await metadata();
  const key = indicadores[0].key;
  const pt = await (await call(`?indicador=${key}`)).json();
  const en = await (await call(`?indicator=${key}`)).json();
  assert.equal(pt.indicador, key);
  assert.equal(en.indicador, key);
});

test("aceita 'periodo' (pt) e 'period' (en) como sinonimos", async () => {
  const { periodos } = await metadata();
  const key = periodos[0].key;
  const pt = await (await call(`?periodo=${key}`)).json();
  const en = await (await call(`?period=${key}`)).json();
  assert.equal(pt.periodo, key);
  assert.equal(en.periodo, key);
});

test("aceita 'modo', 'viewMode' e 'mode' como sinonimos", async () => {
  for (const alias of ["modo", "viewMode", "mode"]) {
    const body = await (await call(`?${alias}=total`)).json();
    assert.equal(body.modo, "total", `alias ${alias} deveria resolver para total`);
  }
});

test("retorna 400 para indicador invalido", async () => {
  const res = call("?indicador=INDICADOR_INEXISTENTE");
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error, "deve devolver mensagem de erro");
});

test("retorna 400 para modo invalido", async () => {
  const res = call("?modo=NAO_EXISTE");
  assert.equal(res.status, 400);
});

test("filtra itens por UF quando fornecida", async () => {
  const all = await (await call()).json();
  const someUf = all.items[0]?.uf;
  if (!someUf) return; // dataset vazio: nada a verificar
  const filtered = await (await call(`?uf=${someUf.toLowerCase()}`)).json();
  assert.ok(filtered.items.every((item) => item.uf === someUf), "todos os itens devem ser da UF pedida");
});
