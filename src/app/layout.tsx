import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { AppFooter } from "@/components/layout/AppFooter";
import { siteConfig } from "@/lib/siteConfig";

// Tipografia do "instrumento de inteligência": Archivo variável (eixo wdth
// 62–125 — títulos expandidos, rótulos condensados) + IBM Plex Mono para
// números, timestamps e metadados. Expostas como CSS vars p/ o Tailwind v4.
const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-archivo",
  axes: ["wdth"],
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  alternates: {
    canonical: "/",
  },
  // Apenas campos globais. title/description/url do Open Graph e do Twitter
  // ficam por resolver para que cada pagina herde os seus proprios valores
  // (titulo via template, descricao da pagina e url via metadataBase + caminho)
  // em vez de propagar os valores da home para as subpaginas.
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    siteName: siteConfig.name,
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${archivo.variable} ${plexMono.variable}`}>
      <body>
        {children}
        <AppFooter />
      </body>
    </html>
  );
}

