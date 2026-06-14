// Leitor de RSS minimo e sem dependencias para a camada OSINT.
// Extrai <item> de feeds RSS 2.0 (titulo, link, descricao, pubDate).
import type { RawArticle } from "@/types/news";

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "") // remove tags HTML residuais da descricao
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decodeEntities(m[1]) : "";
}

// Parseia o XML de um feed RSS num array de artigos. `veiculo` rotula a fonte.
export function parseRss(xml: string, veiculo: string): RawArticle[] {
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  const out: RawArticle[] = [];
  for (const block of items) {
    const titulo = tag(block, "title");
    const url = tag(block, "link");
    if (!titulo || !url) continue;
    const pub = tag(block, "pubDate");
    out.push({
      titulo,
      resumo: tag(block, "description"),
      url,
      publicadoEm: pub ? new Date(pub).toISOString() : null,
      veiculo,
    });
  }
  return out;
}

// Busca e parseia um feed RSS. Lanca em erro de rede/HTTP.
export async function fetchRss(url: string, veiculo: string): Promise<RawArticle[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": "MapaDaViolenciaBrasil/OSINT (+https://mapa-da-violencia-brasil.vercel.app)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`RSS ${veiculo} HTTP ${res.status}`);
  return parseRss(await res.text(), veiculo);
}
