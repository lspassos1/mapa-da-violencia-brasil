import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { NewsDashboard } from "@/components/news/NewsDashboard";

export const metadata: Metadata = {
  title: "Notícias / OSINT",
  description:
    "Indícios de violência extraídos de notícias por IA — não verificados, separados da estatística oficial. Cada item traz fonte, link e confiança.",
  robots: { index: false }, // camada de indícios; não-oficial, fora do índice
};

export default function NoticiasPage() {
  return (
    <div className="flex min-h-screen flex-col text-slate-100">
      <AppHeader />
      <NewsDashboard />
    </div>
  );
}
