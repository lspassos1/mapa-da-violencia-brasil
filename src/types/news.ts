// Tipos da camada OSINT (ocorrencias extraidas de noticias).
// IMPORTANTE: noticias sao INDICIOS, nao base oficial. Cada ocorrencia preserva
// fonte, link, confianca e estado de revisao — nunca apresentada como fato.

export type NewsIncidentType =
  | "homicidio"
  | "feminicidio"
  | "latrocinio"
  | "roubo"
  | "furto"
  | "trafico"
  | "violencia_sexual"
  | "violencia_politica"
  | "outro";

export type NewsReviewStatus = "pendente" | "confirmado" | "rejeitado";

// Saida crua esperada do extrator de IA (antes de geocoding/dedupe).
export interface NewsExtraction {
  ehCrimeViolento: boolean;
  tipo: NewsIncidentType;
  municipio: string | null;
  uf: string | null;
  vitimas: number | null;
  dataOcorrencia: string | null; // "YYYY-MM-DD" quando inferivel
  confianca: number; // 0..1, auto-avaliacao do extrator
  resumo: string;
}

// Ocorrencia ja geolocalizada e pronta para o mapa.
export interface NewsIncident {
  id: string; // hash estavel (chave de dedupe)
  tipo: NewsIncidentType;
  municipio: string;
  uf: string;
  idIbge: string | null; // null quando nao geocodificou
  lat: number | null;
  lng: number | null;
  vitimas: number | null;
  dataOcorrencia: string | null;
  resumo: string;
  fonteUrl: string;
  veiculo: string;
  confianca: number; // 0..1
  reviewStatus: NewsReviewStatus;
  extraidoEm: string; // ISO datetime
  provedor: string; // qual provedor de IA respondeu
}

// Artigo bruto vindo de um feed (RSS) antes da extracao.
export interface RawArticle {
  titulo: string;
  resumo: string;
  url: string;
  publicadoEm: string | null;
  veiculo: string;
}
