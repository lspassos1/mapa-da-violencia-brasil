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

// Um veiculo cobrindo a ocorrencia (apos dedupe, varios veiculos viram fontes
// do MESMO incidente — corroboracao). Cada fonte preserva seu link e confianca.
export interface NewsSource {
  fonteUrl: string; // URL do artigo (redirect do Google por ora; canonica depois)
  veiculo: string; // veiculo real (G1, CNN Brasil...) ou rotulo do feed (fallback)
  provedor: string; // qual provedor de IA extraiu este artigo
  confianca: number; // 0..1, confianca DESTA fonte
  titulo: string; // titulo cru do artigo (lista expansivel + auditoria)
  publicadoEm: string | null; // pubDate ISO do artigo (janela/recencia)
}

// Ocorrencia ja geolocalizada, deduplicada e pronta para o mapa.
export interface NewsIncident {
  id: string; // hash estavel da IDENTIDADE do incidente mesclado (idempotente)
  tipo: NewsIncidentType;
  municipio: string;
  uf: string;
  idIbge: string | null; // null quando nao geocodificou
  lat: number | null;
  lng: number | null;
  vitimas: number | null;
  dataOcorrencia: string | null;
  resumo: string;
  // Registro multi-fonte canonico: todos os veiculos que corroboram (len >= 1),
  // ordenado de forma estavel (confianca desc, fonteUrl asc).
  fontes: NewsSource[];
  corroboracao: number; // nº de veiculos distintos (por veiculo, nao hostname)
  // Espelho da fonte PRIMARIA (maior confianca; desempate fonteUrl asc) — mantido
  // por compat com a UI/mapa que leem campos no topo do incidente.
  fonteUrl: string;
  veiculo: string;
  provedor: string; // qual provedor de IA respondeu (da fonte primaria)
  // ATENCAO: confianca AGREGADA (com boost por corroboracao), nao a da primaria.
  // A confianca crua de cada veiculo vive em fontes[i].confianca.
  confianca: number; // 0..1
  reviewStatus: NewsReviewStatus;
  extraidoEm: string; // ISO datetime
}

// Artigo bruto vindo de um feed (RSS) antes da extracao.
export interface RawArticle {
  titulo: string;
  resumo: string;
  url: string;
  publicadoEm: string | null;
  veiculo: string;
}
