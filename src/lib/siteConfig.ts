// Configuracao base para SEO/metadata. O URL canonico pode ser sobreposto por
// ambiente (NEXT_PUBLIC_SITE_URL); o fallback aponta para o deploy publico.
const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mapa-da-violencia-brasil.vercel.app";

export const siteConfig = {
  name: "Mapa da Violencia Brasil",
  description:
    "Visualizacao geoespacial de indicadores de violencia por municipio no Brasil, a partir de dados oficiais agregados (SINESP/MJSP).",
  // Remove uma eventual barra final para compor URLs de forma previsivel.
  url: rawSiteUrl.replace(/\/$/, ""),
  locale: "pt_BR",
} as const;
