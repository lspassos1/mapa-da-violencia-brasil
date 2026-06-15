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

// Parseia o XML de um feed RSS num array de artigos. `veiculoFallback` rotula a
// fonte quando o item nao traz o veiculo real (o Google News o expoe em
// <source url="...">Veiculo</source> — preferimos esse p/ corroboracao por veiculo).
//
// Nota: no Google News o <link> e um redirect opaco (news.google.com/...), nao a
// URL canonica do artigo. Resolver a canonica (HEAD/GET extra) fica para o
// follow-up de persistencia (ver canonicalUrl). Por ora o redirect serve de
// chave de dedupe exata dentro de uma mesma busca.
export function parseRss(xml: string, veiculoFallback: string): RawArticle[] {
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  const out: RawArticle[] = [];
  for (const block of items) {
    let titulo = tag(block, "title");
    const url = tag(block, "link");
    if (!titulo || !url) continue;
    const pub = tag(block, "pubDate");
    const veiculo = tag(block, "source") || veiculoFallback;
    // Google News anexa " - <Veiculo>" ao titulo; remove p/ nao enviesar a
    // similaridade nem poluir o card (so quando casa com o veiculo extraido).
    if (veiculo && titulo.endsWith(` - ${veiculo}`)) {
      titulo = titulo.slice(0, -(veiculo.length + 3)).trim();
    }
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

// Seam para o follow-up: resolver a URL canonica do artigo a partir do redirect
// do Google News (hoje no-op). Mantido aqui p/ o pipeline poder adota-lo depois
// sem mudar a assinatura. Ver issue de persistencia OSINT.
export function canonicalUrl(url: string): string {
  return url;
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
