import type { Metadata } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { AppFooter } from "@/components/layout/AppFooter";

export const metadata: Metadata = {
  title: "Mapa da Violencia Brasil",
  description: "MVP visual demonstrativo para analise geoespacial de indicadores de violencia.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <AppFooter />
      </body>
    </html>
  );
}

