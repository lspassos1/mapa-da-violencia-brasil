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

// Cobertura ampla mas limitada (custo de IA e teto diario). Cada item do Google
// News ja traz o veiculo real (<source>), entao `veiculo` aqui e so o fallback.
// Mix de tipos de crime + algumas buscas regionais (o Google ranqueia veiculos
// locais por regiao), maximizando a chance de corroboracao entre veiculos.
export const DEFAULT_FEEDS: FeedConfig[] = [
  // Tipos
  { url: googleNews("homicídio Brasil"), veiculo: "Google Notícias" },
  { url: googleNews("feminicídio Brasil"), veiculo: "Google Notícias" },
  { url: googleNews("latrocínio OR \"roubo seguido de morte\" Brasil"), veiculo: "Google Notícias" },
  { url: googleNews("chacina OR massacre Brasil"), veiculo: "Google Notícias" },
  { url: googleNews("\"violência sexual\" OR estupro Brasil"), veiculo: "Google Notícias" },
  { url: googleNews("\"tráfico de drogas\" apreensão Brasil"), veiculo: "Google Notícias" },
  // Tiroteios — alimenta a camada nacional do radar (violência armada por notícia)
  { url: googleNews("tiroteio OR \"troca de tiros\" Brasil"), veiculo: "Google Notícias" },
  { url: googleNews("baleado OR \"morto a tiros\" Brasil"), veiculo: "Google Notícias" },
  // Regionais (afloram veiculos locais que o Google ranqueia por regiao). Inclui
  // capitais FORA das 4 metros do Fogo Cruzado p/ ampliar a cobertura nacional.
  { url: googleNews("homicídio São Paulo"), veiculo: "Google Notícias" },
  { url: googleNews("homicídio \"Rio de Janeiro\""), veiculo: "Google Notícias" },
  { url: googleNews("homicídio \"Belo Horizonte\" OR \"Porto Alegre\" OR Curitiba OR Goiânia"), veiculo: "Google Notícias" },
  { url: googleNews("homicídio Manaus OR Fortaleza OR Brasília"), veiculo: "Google Notícias" },
  { url: googleNews("violência Nordeste"), veiculo: "Google Notícias" },
];
