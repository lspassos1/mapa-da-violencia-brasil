// Hooks de resolucao/carregamento para testes de rotas de API:
// - mapeia o alias "@/..." para src/...
// - substitui "next/server" por um stub leve
// - carrega imports .json sem exigir o atributo de importacao
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const srcURL = new URL("../../src/", import.meta.url);
const stubURL = new URL("./next-server-stub.mjs", import.meta.url).href;
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
  if (specifier === "next/server") {
    return { url: stubURL, shortCircuit: true };
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
