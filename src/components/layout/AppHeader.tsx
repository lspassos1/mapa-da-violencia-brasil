"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Github, MapPinned, Menu, Radar, X } from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  title?: string;
  tone?: "default" | "warn";
}

const NAV: NavItem[] = [
  { href: "/comparar", label: "Comparar" },
  { href: "/tendencias", label: "Tendências" },
  { href: "/radar", label: "Radar", title: "Radar de anomalia sobre o dado oficial" },
  { href: "/noticias", label: "Notícias", title: "Indícios de notícias (OSINT) — não-oficial", tone: "warn" },
  { href: "/metodologia", label: "Metodologia" },
];

const LIVE_HREF = "/radar/tiroteios";
const REPO = "https://github.com/lspassos1/mapa-da-violencia-brasil";
const ALL_HREFS = [...NAV.map((n) => n.href), LIVE_HREF];

// Rota ativa = o href MAIS ESPECÍFICO que casa (evita /radar acender junto de
// /radar/tiroteios).
function bestMatch(pathname: string): string | null {
  let best: string | null = null;
  for (const h of ALL_HREFS) {
    if (pathname === h || pathname.startsWith(h + "/")) {
      if (!best || h.length > best.length) best = h;
    }
  }
  return best;
}

export function AppHeader() {
  const pathname = usePathname() ?? "/";
  const active = bestMatch(pathname);
  const [open, setOpen] = useState(false);

  const linkCls = (item: NavItem) => {
    const isActive = active === item.href;
    const warn = item.tone === "warn";
    return [
      "rounded-lg border px-3 py-2 text-sm font-medium transition",
      isActive
        ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-100"
        : warn
          ? "border-amber-300/25 text-amber-100/90 hover:border-amber-300/50 hover:text-amber-50"
          : "border-white/10 text-slate-300 hover:border-cyan-300/40 hover:bg-white/[0.04] hover:text-cyan-100",
    ].join(" ");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <Link href="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400/25 to-sky-500/10 text-cyan-200 ring-1 ring-inset ring-cyan-300/20">
            <MapPinned className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <h1 className="text-base font-semibold tracking-tight text-slate-50 sm:text-lg">Mapa da Violência Brasil</h1>
            <p className="hidden text-xs text-slate-400 sm:block">Dados oficiais + camadas de indício, separadas</p>
          </div>
        </Link>

        {/* Desktop */}
        <nav className="hidden items-center gap-1.5 lg:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} title={item.title} className={linkCls(item)}>
              {item.label}
            </Link>
          ))}
          <Link
            href={LIVE_HREF}
            className={`ml-1 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              active === LIVE_HREF
                ? "bg-red-400 text-slate-950"
                : "bg-red-500/15 text-red-100 ring-1 ring-inset ring-red-400/40 hover:bg-red-500/25 hover:text-red-50"
            }`}
            title="Radar de tiroteios em tempo quase real (Fogo Cruzado)"
          >
            <Radar className="h-4 w-4" />
            Radar ao vivo
          </Link>
          <a
            href={REPO}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ver o código-fonte no GitHub (licença AGPL-3.0)"
            title="Código-fonte (GitHub)"
            className="ml-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-300 hover:border-cyan-300/40 hover:text-cyan-100"
          >
            <Github className="h-4 w-4" />
          </a>
        </nav>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-slate-200 hover:border-cyan-300/40 hover:text-cyan-100 lg:hidden"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          aria-controls="mobile-nav"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile panel */}
      {open ? (
        <nav id="mobile-nav" className="grid gap-1.5 border-t border-white/10 bg-slate-950/95 px-4 py-3 lg:hidden">
          <Link
            href={LIVE_HREF}
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-2 rounded-lg bg-red-500/15 px-3 py-2.5 text-sm font-semibold text-red-100 ring-1 ring-inset ring-red-400/40"
          >
            <Radar className="h-4 w-4" /> Radar ao vivo
          </Link>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={linkCls(item)}>
              {item.label}
            </Link>
          ))}
          <a
            href={REPO}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-slate-300 hover:border-cyan-300/40 hover:text-cyan-100"
          >
            <Github className="h-4 w-4" /> Código-fonte
          </a>
        </nav>
      ) : null}
    </header>
  );
}
