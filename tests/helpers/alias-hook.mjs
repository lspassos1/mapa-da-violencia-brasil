// Module-resolution hook que mapeia o alias "@/..." (definido em tsconfig
// "paths") para a pasta src/, permitindo que os testes node:test importem
// modulos .ts que fazem import de valor via "@/". Imports type-only sao
// removidos pelo type stripping e nunca chegam aqui.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const srcURL = new URL("../../src/", import.meta.url);
const EXTENSIONS = [".ts", ".tsx", ".mjs", ".js", "/index.ts", "/index.tsx"];

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const relative = specifier.slice(2);
    for (const extension of EXTENSIONS) {
      const candidate = new URL(relative + extension, srcURL);
      if (existsSync(fileURLToPath(candidate))) {
        return nextResolve(candidate.href, context);
      }
    }
  }
  return nextResolve(specifier, context);
}
