import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

// Origens externas de mapa (tiles raster CARTO). O wildcard cobre os
// subdominios a/b/c/d usados para distribuir a carga de tiles.
const MAP_TILE_ORIGIN = "https://*.basemaps.cartocdn.com";
// Origem do Supabase (consumida quando o app passar a ler das views reais).
const SUPABASE_ORIGIN = "https://*.supabase.co";

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
  // Tiles e (futuramente) Supabase sao carregados via fetch/XHR.
  "connect-src 'self' " + MAP_TILE_ORIGIN + " " + SUPABASE_ORIGIN,
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
