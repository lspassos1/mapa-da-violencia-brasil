import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

// Origens externas de mapa (tiles raster CARTO). O wildcard cobre os
// subdominios a/b/c/d usados para distribuir a carga de tiles.
const MAP_TILE_ORIGIN = "https://*.basemaps.cartocdn.com";

// Origem do Supabase (Storage da carga nacional no modo `supabase`). Usa o
// project-ref real quando configurado; caso contrario o wildcard *.supabase.co.
const SUPABASE_ORIGIN = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    return url ? new URL(url).origin : "https://*.supabase.co";
  } catch {
    return "https://*.supabase.co";
  }
})();

// Em DEV o React/Turbopack (RSC) usam eval() para ferramentas de depuracao, o que
// dispara um erro de console quando a CSP nao permite 'unsafe-eval'. Em PRODUCAO o
// React nunca usa eval(), entao liberamos 'unsafe-eval' SO em desenvolvimento e
// mantemos a CSP estrita no build/prod.
const isDev = process.env.NODE_ENV !== "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  // Next.js injeta scripts inline para hidratacao; 'unsafe-eval' so em dev (ver acima).
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  // MapLibre injeta estilos inline para os controlos/canvas.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: " + MAP_TILE_ORIGIN,
  "font-src 'self' data:",
  // MapLibre cria web workers a partir de blobs.
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  // fetch/XHR: tiles (CARTO) e a carga nacional do Supabase Storage (modo supabase).
  "connect-src 'self' " + MAP_TILE_ORIGIN + " " + SUPABASE_ORIGIN,
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // geolocation=(self): o próprio site pode usar geolocalização (feature "Perto de
  // mim" no radar). camera/microfone seguem desligados (não usamos).
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  // Em serverless (Vercel/Lambda) a pasta public/ e servida pelo CDN e NAO fica
  // no filesystem da funcao. As rotas de API leem public/officialCrimeData.json
  // via fs (modo official), por isso incluimo-lo explicitamente no bundle de
  // tracing das funcoes para que process.cwd()/public/... exista em runtime.
  outputFileTracingIncludes: {
    "/api/**": ["./public/officialCrimeData.json.gz"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
