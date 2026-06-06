import assert from "node:assert/strict";

// Contrato de erro partilhado das rotas de API: respostas de erro devem ter o
// status HTTP esperado e um corpo `{ error: string }` nao vazio (nunca um
// payload ambiguo de sucesso). Centralizado para que todas as rotas validem o
// mesmo formato.
export async function assertErrorPayload(response, expectedStatus) {
  assert.equal(response.status, expectedStatus, `status deveria ser ${expectedStatus}`);
  const body = await response.json();
  assert.equal(typeof body.error, "string", "corpo de erro deve ter `error: string`");
  assert.ok(body.error.length > 0, "mensagem de erro nao deve ser vazia");
  assert.ok(!("items" in body), "resposta de erro nao deve incluir payload de sucesso (items)");
  return body;
}

// Espelho de sucesso: garante 200 e ausencia do campo `error`.
export async function assertOkPayload(response) {
  assert.equal(response.status, 200, "status deveria ser 200");
  const body = await response.json();
  assert.ok(!("error" in body), "resposta de sucesso nao deve incluir `error`");
  return body;
}
