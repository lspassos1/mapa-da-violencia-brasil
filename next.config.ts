import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

// Origens externas de mapa (tiles raster CARTO). O wildcard cobre os
// subdominios a/b/c/d usados para distribuir a carga de tiles.
const MAP_TILE_ORIGIN = "https://*.basemaps.cartocdn.com";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  // Next.js injeta scripts inline para hidratacao.
  "script-src 'self' 'unsafe-inline'",
  // MapLibre injeta estilos inline para os controlos/canvas.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: " + MAP_TILE_ORIGIN,
  "font-src 'self' data:",
  // MapLibre cria web workers a partir de blobs.
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  // Tiles carregados via fetch/XHR. A origem do Supabase sera adicionada
  // (com o project-ref real, sem wildcard) no PR que introduzir a leitura
  // das views reais, para nao permitir uma origem ainda nao utilizada.
  "connect-src 'self' " + MAP_TILE_ORIGIN,
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
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
