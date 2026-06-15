// Similaridade textual deterministica (sem embeddings/sem rede) para dedupe
// cross-source da camada OSINT: decide se dois artigos cobrem a MESMA ocorrencia.
//
// Metrica: Jaccard de tokens sobre o titulo+resumo normalizados. Escolhida por
// ser simetrica, barata e robusta a reescritas (veiculos diferentes redigem o
// mesmo fato com palavras parcialmente sobrepostas). A funcao fica atras deste
// seam para poder trocar por trigram-cosseno/MinHash no futuro sem mexer no
// pipeline.
import { normalizeName } from "@/server/osint/geocode";

// Palavras genericas que inflariam o Jaccard sem discriminar a ocorrencia.
const STOPWORDS = new Set([
  // Conectivos/comuns
  "de", "da", "do", "das", "dos", "em", "no", "na", "nos", "nas", "um", "uma",
  "uns", "umas", "que", "com", "por", "para", "pra", "os", "as", "ao", "aos",
  "e", "o", "a", "se", "sua", "seu", "foi", "apos", "sobre", "entre", "ate",
  "pelo", "pela", "ser", "tem", "mais", "dia", "anos", "ano",
  // Vocabulario generico de crime: aparece em quase toda noticia policial e
  // inflaria a similaridade entre ocorrencias DISTINTAS — sobretudo no bucket
  // sem-geo, onde nao ha municipio p/ desambiguar. Sai p/ que so o conteudo
  // especifico (local, nomes, circunstancia) dirija a similaridade.
  "morto", "morta", "mortos", "mortas", "morte", "mortes", "tiro", "tiros",
  "baleado", "baleada", "baleados", "vitima", "vitimas", "homem", "mulher",
  "preso", "presa", "presos", "crime", "policia", "suspeito", "caso",
]);

// titulo+resumo -> conjunto de tokens significativos (sem acento/caixa, >=3 chars,
// sem stopwords). Reusa normalizeName (mesma normalizacao do geocoding).
export function tokenize(texto: string): Set<string> {
  const out = new Set<string>();
  for (const tok of normalizeName(texto).split(" ")) {
    if (tok.length >= 3 && !STOPWORDS.has(tok)) out.add(tok);
  }
  return out;
}

// Tokens de um artigo (titulo tem mais peso na pratica, mas tratamos como bag).
export function articleTokens(titulo: string, resumo: string): Set<string> {
  return tokenize(`${titulo} ${resumo}`);
}

// Indice de Jaccard: |A ∩ B| / |A ∪ B|, em [0,1]. Simetrico; 1 = iguais; 0 = disjuntos.
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}
