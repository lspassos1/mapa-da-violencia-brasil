import assert from "node:assert/strict";
import test from "node:test";

import { resolveCrimeDataMode } from "../src/lib/dataMode.ts";

test("valor ausente recai em demo", () => {
  assert.equal(resolveCrimeDataMode(undefined), "demo");
  assert.equal(resolveCrimeDataMode(""), "demo");
});

test("supabase, official, official_sample e demo sao reconhecidos", () => {
  assert.equal(resolveCrimeDataMode("supabase"), "supabase");
  assert.equal(resolveCrimeDataMode("official"), "official");
  assert.equal(resolveCrimeDataMode("official_sample"), "official_sample");
  assert.equal(resolveCrimeDataMode("demo"), "demo");
});

test("valor desconhecido recai em demo e avisa", () => {
  const original = console.warn;
  const calls = [];
  console.warn = (...args) => calls.push(args.join(" "));
  try {
    assert.equal(resolveCrimeDataMode("oficial"), "demo");
    assert.equal(resolveCrimeDataMode("NEXT_PUBLIC_DATA_MODE"), "demo");
  } finally {
    console.warn = original;
  }
  assert.equal(calls.length, 2, "deve avisar uma vez por valor desconhecido");
  assert.match(calls[0], /NEXT_PUBLIC_CRIME_DATA_MODE/);
});
