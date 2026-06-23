// Extrator HIBRIDO da camada OSINT (keyword-first + dicionario + LLM) — SERVER-ONLY.
//
// Decola o teto de volume: o LLM (caro, ~12/exec no Hobby) so e gasto onde o
// dicionario NAO alcanca. Por artigo:
//   - sem sinal de crime (keyword) -> ehCrimeViolento=false (pipeline descarta), SEM LLM
//   - crime + cidade resolvida por DICIONARIO do titulo -> extracao sintetica, SEM LLM
//   - crime sem geo de dicionario -> LLM ate o orcamento (resolve municipio/uf)
// Assim processamos um pool grande de artigos gastando o LLM so no essencial.
import "server-only";
import type { NewsExtraction, RawArticle } from "@/types/news";
import { createExtractor, type ExtractResult } from "@/server/osint/providers";
import { keywordScore } from "@/server/osint/keywords";
import { geocodeFromText } from "@/server/osint/geocode";

const NAO_CRIME: NewsExtraction = {
  ehCrimeViolento: false,
  tipo: "outro",
  municipio: null,
  uf: null,
  vitimas: null,
  dataOcorrencia: null,
  confianca: 0,
  resumo: "",
};

export function createHybridExtractor(
  llmBudget: number,
  llm: (a: RawArticle) => Promise<ExtractResult | null> = createExtractor(),
): (a: RawArticle) => Promise<ExtractResult | null> {
  let budget = llmBudget;
  return async (a) => {
    const hit = keywordScore(a);
    if (!hit) return { extraction: NAO_CRIME, provedor: "keyword" }; // descarte sem LLM

    const geo = geocodeFromText(`${a.titulo} ${a.resumo}`);
    if (geo) {
      // keyword (tipo) + dicionario (local), sem LLM. Confianca moderada (sem
      // verificacao do modelo) -> fica em revisao (pendente), nunca auto-confirma.
      const extraction: NewsExtraction = {
        ehCrimeViolento: true,
        tipo: hit.tipo,
        municipio: geo.municipio,
        uf: geo.uf,
        vitimas: null,
        dataOcorrencia: null,
        confianca: 0.5,
        resumo: a.titulo,
      };
      return { extraction, provedor: "keyword+dict" };
    }

    if (budget > 0) {
      budget--;
      return llm(a); // so aqui gasta o LLM
    }
    return null; // sem orcamento e sem geo de dicionario -> nao ingere
  };
}
