import assert from "node:assert/strict";
import test from "node:test";

import { GET as crimeMapGET } from "../../src/app/api/crime-map/route.ts";
import { GET as metadataGET } from "../../src/app/api/metadata/route.ts";
import { assertErrorPayload, assertOkPayload } from "../helpers/api-assert.mjs";

function call(query = "") {
  return crimeMapGET(new Request(`http://localhost/api/crime-map${query}`));
}

async function metadata() {
  return (await (await metadataGET()).json());
}

test("responde 200 com a forma esperada do payload", async () => {
  const body = await assertOkPayload(call());
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
  const { indicadores, filtrosPadrao } = await metadata();
  // Usa uma key DIFERENTE do default: assim, se o ramo de alias for removido,
  // o fallback para o default nao mascara a regressao.
  const key = indicadores.map((indicator) => indicator.key).find((k) => k !== filtrosPadrao.indicator);
  if (!key) return; // dataset com um unico indicador: nada a distinguir
  const pt = await (await call(`?indicador=${key}`)).json();
  const en = await (await call(`?indicator=${key}`)).json();
  assert.equal(pt.indicador, key, "param pt deve ser respeitado");
  assert.equal(en.indicador, key, "param en deve ser respeitado");
});

test("aceita 'periodo' (pt) e 'period' (en) como sinonimos", async () => {
  const { periodos, filtrosPadrao } = await metadata();
  const key = periodos.map((period) => period.key).find((k) => k !== filtrosPadrao.period);
  if (!key) return; // dataset com um unico periodo: nada a distinguir
  const pt = await (await call(`?periodo=${key}`)).json();
  const en = await (await call(`?period=${key}`)).json();
  assert.equal(pt.periodo, key, "param pt deve ser respeitado");
  assert.equal(en.periodo, key, "param en deve ser respeitado");
});

test("aceita 'modo', 'viewMode' e 'mode' como sinonimos", async () => {
  for (const alias of ["modo", "viewMode", "mode"]) {
    const body = await (await call(`?${alias}=total`)).json();
    assert.equal(body.modo, "total", `alias ${alias} deveria resolver para total`);
  }
});

test("retorna 400 para indicador invalido (contrato de erro)", async () => {
  await assertErrorPayload(call("?indicador=INDICADOR_INEXISTENTE"), 400);
});

test("retorna 400 para modo invalido (contrato de erro)", async () => {
  await assertErrorPayload(call("?modo=NAO_EXISTE"), 400);
});

test("filtra itens por UF quando fornecida", async () => {
  const all = await (await call()).json();
  const someUf = all.items[0]?.uf;
  if (!someUf) return; // dataset vazio: nada a verificar
  const filtered = await (await call(`?uf=${someUf.toLowerCase()}`)).json();
  assert.ok(filtered.items.every((item) => item.uf === someUf), "todos os itens devem ser da UF pedida");
});
