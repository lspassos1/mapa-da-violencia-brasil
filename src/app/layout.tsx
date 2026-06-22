import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { AppFooter } from "@/components/layout/AppFooter";
import { siteConfig } from "@/lib/siteConfig";

// Fonte variável moderna (substitui Arial). Exposta como --font-sans p/ o Tailwind.
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

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
    <html lang="pt-BR" className={inter.variable}>
      <body>
        {children}
        <AppFooter />
      </body>
    </html>
  );
}

