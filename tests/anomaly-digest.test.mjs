import assert from "node:assert/strict";
import test from "node:test";

import { buildDigestPrompt, FONTES } from "../src/server/anomaly/digest.ts";

test("buildDigestPrompt: system carrega a moldura inegociável", () => {
  const { system } = buildDigestPrompt({ indicador: "x", eleitorais: [], governanca: [] });
  assert.match(system, /IND[IÍ]CIO/i);
  assert.match(system, /APARTID[AÁ]RIO/i);
  assert.match(system, /CONFUNDIDORES/i);
});

test("buildDigestPrompt: inclui os sinais e as fontes no user", () => {
  const { user } = buildDigestPrompt({
    indicador: "homicídio doloso",
    eleitorais: [{ uf: "PR", porte: "medio", efeito: -0.081, efeitoRelativo: -0.13 }],
    governanca: [{ municipio: "São Gonçalo", disputaShare: 0.02, extorsao: 120 }],
  });
  assert.match(user, /PR/);
  assert.match(user, /São Gonçalo/);
  assert.match(user, /-13\.0%|13\.0%/); // efeito relativo em %
  for (const f of FONTES) assert.ok(user.includes(f), `cita fonte: ${f}`);
});

test("buildDigestPrompt: sem sinais usa placeholders (não inventa)", () => {
  const { user } = buildDigestPrompt({ indicador: "x", eleitorais: [], governanca: [] });
  assert.match(user, /nenhum sinal eleitoral robusto/i);
  assert.match(user, /nenhum munic[ií]pio com ind[ií]cio de controle/i);
});
