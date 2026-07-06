import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Link de "voltar" com afford­ância clara (seta + moldura de botão), distinto de
// títulos/eyebrows — antes era só texto ciano e se confundia com o cabeçalho.
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex w-fit items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-1.5 text-sm font-medium text-sec hover:border-edgehover hover:bg-cellhead hover:text-ink"
    >
      <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
      {children}
    </Link>
  );
}
