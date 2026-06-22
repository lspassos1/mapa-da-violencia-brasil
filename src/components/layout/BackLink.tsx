import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Link de "voltar" com afford­ância clara (seta + moldura de botão), distinto de
// títulos/eyebrows — antes era só texto ciano e se confundia com o cabeçalho.
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex w-fit items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm font-medium text-slate-300 hover:border-cyan-300/40 hover:bg-white/[0.06] hover:text-cyan-100"
    >
      <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
      {children}
    </Link>
  );
}
