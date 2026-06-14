// Feeds padrao da camada OSINT (PoC). Google Noticias RSS e gratis e agrega
// varios veiculos; produção deve migrar para feeds diretos das redacoes/SSPs
// (ver issue #84 — ingestao multi-fonte). O link e um redirect do Google News.
export interface FeedConfig {
  url: string;
  veiculo: string;
}

function googleNews(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query + " when:7d")}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
}

export const DEFAULT_FEEDS: FeedConfig[] = [
  { url: googleNews("homicídio Brasil"), veiculo: "Google Notícias" },
  { url: googleNews("feminicídio Brasil"), veiculo: "Google Notícias" },
  { url: googleNews("latrocínio OR \"roubo seguido de morte\" Brasil"), veiculo: "Google Notícias" },
];
