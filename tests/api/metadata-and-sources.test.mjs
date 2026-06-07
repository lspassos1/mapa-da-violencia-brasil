import assert from "node:assert/strict";
import test from "node:test";

import { GET as metadataGET } from "../../src/app/api/metadata/route.ts";
import { GET as sourcesGET } from "../../src/app/api/sources/status/route.ts";

test("/api/metadata expoe indicadores, periodos, modos e escopo", async () => {
  const res = await metadataGET();
  assert.equal(res.status, 200);
  const body = await res.json();
  for (const key of ["indicadores", "periodos", "ufs", "modos", "filtrosPadrao", "modoDados", "escopo"]) {
    assert.ok(key in body, `metadata deve incluir ${key}`);
  }
  assert.ok(Array.isArray(body.indicadores) && body.indicadores.length > 0);
  assert.ok(Array.isArray(body.modos) && body.modos.length > 0);
  assert.ok(body.indicadores[0].key, "cada indicador deve ter key");
  assert.equal(typeof body.escopo.municipalities, "number");
});

test("/api/sources/status expoe a lista de fontes com limitacoes", async () => {
  const res = await sourcesGET();
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.fontes) && body.fontes.length > 0, "deve listar fontes");
  const fonte = body.fontes[0];
  for (const key of ["id", "nome", "status", "ultimaAtualizacao", "limitacoes"]) {
    assert.ok(key in fonte, `fonte deve incluir ${key}`);
  }
  assert.ok(Array.isArray(fonte.limitacoes), "limitacoes deve ser array");
});
