// Module-resolution/loading hook que mapeia o alias "@/..." (definido em tsconfig
// "paths") para a pasta src/, permitindo que os testes node:test importem
// modulos .ts que fazem import de valor via "@/". Imports type-only sao
// removidos pelo type stripping e nunca chegam aqui. Tambem carrega imports
// .json (sem exigir o atributo de importacao), para modulos que dependem de
// dados versionados (ex.: a malha estadual).
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const srcURL = new URL("../../src/", import.meta.url);
// "" tenta o caminho exato (ex.: imports .json ja com extensao) antes dos sufixos.
const EXTENSIONS = ["", ".ts", ".tsx", ".mjs", ".js", "/index.ts", "/index.tsx"];

function isFile(url) {
  try {
    return statSync(fileURLToPath(url)).isFile();
  } catch {
    return false;
  }
}

export async function resolve(specifier, context, nextResolve) {
  // "server-only"/"client-only" sao marcadores do Next sem pacote no node:test —
  // resolvemos para um stub vazio (modulos server podem ser testados aqui).
  if (specifier === "server-only" || specifier === "client-only") {
    return { url: new URL("./server-only-stub.mjs", import.meta.url).href, shortCircuit: true };
  }
  if (specifier.startsWith("@/")) {
    const relative = specifier.slice(2);
    for (const extension of EXTENSIONS) {
      const candidate = new URL(relative + extension, srcURL);
      if (isFile(candidate)) {
        return { url: candidate.href, shortCircuit: true };
      }
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".json")) {
    const source = readFileSync(fileURLToPath(url), "utf8");
    return { format: "json", source, shortCircuit: true };
  }
  return nextLoad(url, context);
}
