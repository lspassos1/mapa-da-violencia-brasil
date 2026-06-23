// Classificador KEYWORD-FIRST (estilo worldmonitor) — SEM LLM, instantâneo.
//
// Problema: cada artigo custa 1 chamada de LLM e o teto (free tier / 60s Hobby) é
// baixo. Antes gastávamos esse orçamento nos PRIMEIROS artigos (ordem arbitrária
// dos feeds). Aqui pré-filtramos por sinal criminal e RANQUEAMOS por relevância —
// o LLM (caro) é gasto só nos melhores candidatos, multiplicando o rendimento de
// incidentes úteis (e priorizando violência armada, alvo do radar).
import type { NewsIncidentType, RawArticle } from "@/types/news";

interface Rule {
  tipo: NewsIncidentType;
  weight: number;
  re: RegExp;
}

// Ordem por especificidade: regras mais específicas (peso maior) vencem o empate.
const RULES: Rule[] = [
  { tipo: "feminicidio", weight: 5, re: /feminic[ií]dio/i },
  { tipo: "latrocinio", weight: 5, re: /latroc[ií]nio|roubo seguido de morte/i },
  { tipo: "homicidio", weight: 4, re: /homic[ií]dio|assassinad|morto[as]? a tiros|balead|executad|chacina|massacre|duplo homic/i },
  { tipo: "violencia_sexual", weight: 3, re: /estupro|viol[êe]ncia sexual|abuso sexual/i },
  { tipo: "trafico", weight: 2, re: /tr[áa]fico de drogas|apreens[ãa]o de (drogas|entorpecentes)/i },
];

const FIREARM = /arma de fogo|balead|a tiros|\btiros?\b|disparo|fuzil|pistola|rev[óo]lver|tiroteio|troca de tiros|met(ralhad|ralha)/i;
// EVENTO de tiroteio (não só menção a arma): captura manchetes como "Tiroteio
// deixa mortos" / "homem baleado" que não trazem a palavra "homicídio" mas são o
// alvo do radar. Mais restrito que FIREARM (não pega "apreensão de pistola").
const SHOOTING_EVENT = /tiroteio|troca de tiros|balead|a tiros|atingid[oa]s? a tiros|sob disparos|a bala/i;

export interface KeywordHit {
  tipo: NewsIncidentType;
  firearm: boolean;
  score: number;
}

// Pontua um artigo por relevância criminal (sem LLM). null = sem sinal de crime
// (descartado de graça, não consome orçamento de LLM).
export function keywordScore(a: RawArticle): KeywordHit | null {
  const text = `${a.titulo} ${a.resumo}`;
  let best: Rule | null = null;
  for (const r of RULES) if (r.re.test(text) && (!best || r.weight > best.weight)) best = r;
  // Sem tipo explícito, mas é um evento de tiroteio -> homicídio (violência armada).
  if (!best && SHOOTING_EVENT.test(text)) best = { tipo: "homicidio", weight: 3, re: SHOOTING_EVENT };
  if (!best) return null;
  const firearm = FIREARM.test(text);
  return { tipo: best.tipo, firearm, score: best.weight + (firearm ? 2 : 0) };
}

// Mantém só artigos com sinal de crime e os ORDENA por relevância (desc).
// Determinístico (desempate por URL) → reexecutável. O LLM processa os primeiros.
export function rankByRelevance(articles: RawArticle[]): RawArticle[] {
  return articles
    .map((a) => ({ a, hit: keywordScore(a) }))
    .filter((x): x is { a: RawArticle; hit: KeywordHit } => x.hit !== null)
    .sort((x, y) => y.hit.score - x.hit.score || (x.a.url < y.a.url ? -1 : x.a.url > y.a.url ? 1 : 0))
    .map((x) => x.a);
}
