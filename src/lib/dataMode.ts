// Resolucao centralizada do modo de dados do app.
//
// Apenas `NEXT_PUBLIC_CRIME_DATA_MODE` controla o app. O nome legado
// `NEXT_PUBLIC_DATA_MODE` nunca teve efeito e foi descontinuado da documentacao
// para evitar configuracoes enganosas.

export type CrimeDataMode = "demo" | "official_sample" | "official";

export const CRIME_DATA_MODE_FLAG = "NEXT_PUBLIC_CRIME_DATA_MODE";

/**
 * Normaliza o valor cru da variavel de ambiente para um modo conhecido.
 * - `official`: carga nacional oficial (asset estatico public/officialCrimeData.json,
 *   carregado via fetch/filesystem, fora do bundle).
 * - `official_sample`: amostra oficial versionada (parcial).
 * Valores ausentes, vazios ou `demo` mantem o modo demonstrativo; qualquer
 * valor desconhecido tambem recai em `demo`, mas emite um aviso para nao
 * mascarar erros de configuracao.
 */
export function resolveCrimeDataMode(raw: string | undefined): CrimeDataMode {
  if (raw === "official") {
    return "official";
  }
  if (raw === "official_sample") {
    return "official_sample";
  }
  if (raw === undefined || raw === "" || raw === "demo") {
    return "demo";
  }
  if (typeof console !== "undefined") {
    console.warn(
      `[dataMode] Valor desconhecido para ${CRIME_DATA_MODE_FLAG}: "${raw}". A usar "demo".`,
    );
  }
  return "demo";
}

// Acesso literal a process.env.NEXT_PUBLIC_CRIME_DATA_MODE para que o Next.js
// faca o inline do valor no bundle do cliente em tempo de build.
export const CRIME_DATA_MODE: CrimeDataMode = resolveCrimeDataMode(
  process.env.NEXT_PUBLIC_CRIME_DATA_MODE,
);
