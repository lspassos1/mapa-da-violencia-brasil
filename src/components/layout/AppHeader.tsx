"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeaderClock } from "@/components/layout/HeaderClock";
import { FidelityRibbon } from "@/components/layout/FidelityRibbon";

// Header 58px sticky do "instrumento de inteligência": 4 itens principais +
// "MAIS ▾" (Comparar/Tendências/Notícias, decisão #2 do handoff). O relógio
// vive em <HeaderClock/> isolado — o tick de 1s não re-renderiza esta árvore.

interface NavItem {
  href: string;
  label: string;
  title?: string;
  live?: boolean;
}

const NAV: NavItem[] = [
  { href: "/", label: "AO VIVO", title: "Radar de tiroteios em tempo quase real (Fogo Cruzado)", live: true },
  { href: "/mapa", label: "MAPA OFICIAL", title: "Estatística oficial consolidada (SINESP/MJSP)" },
  { href: "/radar", label: "RADAR DE ANOMALIA", title: "Credibilidade do dado oficial — três lentes" },
  { href: "/metodologia", label: "METODOLOGIA", title: "A moldura inegociável" },
];

const MAIS: NavItem[] = [
  { href: "/comparar", label: "COMPARAR" },
  { href: "/tendencias", label: "TENDÊNCIAS" },
  { href: "/noticias", label: "NOTÍCIAS / OSINT", title: "Indícios de notícias — não-oficial" },
];

const REPO = "https://github.com/lspassos1/mapa-da-violencia-brasil";
const ALL = [...NAV, ...MAIS].map((n) => n.href);

// Rota ativa = o href MAIS ESPECÍFICO que casa (evita / acender junto de tudo).
function bestMatch(pathname: string): string | null {
  let best: string | null = null;
  for (const h of ALL) {
    if (pathname === h || (h !== "/" && pathname.startsWith(h + "/"))) {
      if (!best || h.length > best.length) best = h;
    }
  }
  return best ?? (pathname === "/" ? "/" : null);
}

// Mira de radar da marca (SVG exato da referência).
function BrandMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <circle cx="13" cy="13" r="9.5" stroke="#3A4048" strokeWidth="1.2" />
      <circle cx="13" cy="13" r="4.5" stroke="#6C717A" strokeWidth="1" />
      <line x1="13" y1="0.5" x2="13" y2="6" stroke="#6C717A" strokeWidth="1.2" />
      <line x1="13" y1="20" x2="13" y2="25.5" stroke="#6C717A" strokeWidth="1.2" />
      <line x1="0.5" y1="13" x2="6" y2="13" stroke="#6C717A" strokeWidth="1.2" />
      <line x1="20" y1="13" x2="25.5" y2="13" stroke="#6C717A" strokeWidth="1.2" />
      <circle cx="13" cy="13" r="2" fill="#E5484D" />
    </svg>
  );
}

export function AppHeader() {
  const pathname = usePathname() ?? "/";
  const active = bestMatch(pathname);
  const [open, setOpen] = useState(false); // menu mobile
  const [maisOpen, setMaisOpen] = useState(false);
  const maisRef = useRef<HTMLDivElement | null>(null);

  // Fecha o dropdown MAIS em clique fora / Escape.
  useEffect(() => {
    if (!maisOpen) return;
    const onDown = (e: MouseEvent) => {
      if (maisRef.current && !maisRef.current.contains(e.target as Node)) setMaisOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMaisOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [maisOpen]);

  const maisActive = MAIS.some((m) => active === m.href);

  return (
    <div className="sticky top-0 z-50">
      <header className="flex h-[58px] items-stretch border-b border-line bg-[rgba(10,11,13,.94)] backdrop-blur-[14px]">
        {/* marca */}
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 border-r border-line px-5"
          aria-label="Mapa da Violência Brasil — início"
        >
          <BrandMark />
          <span className="leading-[1.15]">
            <span className="block text-[12.5px] font-bold tracking-[.13em] text-ink [font-stretch:122%]">
              MAPA DA VIOLÊNCIA
            </span>
            <span className="mt-0.5 block font-mono text-[9px] tracking-[.3em] text-[#6C717A]">
              BRASIL — CAMADAS SEPARADAS
            </span>
          </span>
        </Link>

        {/* nav desktop */}
        <nav className="hidden flex-1 items-stretch lg:flex" aria-label="Navegação principal">
          {NAV.map((item) => {
            const isActive = active === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.title}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex items-center gap-[7px] border-r border-hair px-[18px] font-mono text-[10.5px] tracking-[.18em] hover:bg-cellhead hover:text-ink ${
                  isActive ? "text-ink" : "text-sec"
                }`}
              >
                {item.live ? <span className="pulse-live h-1.5 w-1.5 rounded-full bg-registro" /> : null}
                {item.label}
                {isActive ? (
                  <span
                    className={`absolute inset-x-0 -bottom-px h-0.5 ${item.live ? "bg-registro" : "bg-ink"}`}
                    aria-hidden="true"
                  />
                ) : null}
              </Link>
            );
          })}

          {/* MAIS ▾ — Comparar / Tendências / Notícias (decisão #2) */}
          <div ref={maisRef} className="relative flex items-stretch">
            <button
              type="button"
              onClick={() => setMaisOpen((v) => !v)}
              aria-expanded={maisOpen}
              aria-haspopup="menu"
              className={`relative flex items-center gap-1.5 border-r border-hair px-[18px] font-mono text-[10.5px] tracking-[.18em] hover:bg-cellhead hover:text-ink ${
                maisActive ? "text-ink" : "text-sec"
              }`}
            >
              MAIS <span aria-hidden="true" className="text-[8px]">▾</span>
              {maisActive ? <span className="absolute inset-x-0 -bottom-px h-0.5 bg-ink" aria-hidden="true" /> : null}
            </button>
            {maisOpen ? (
              <div
                role="menu"
                className="absolute left-0 top-full z-50 min-w-[190px] border border-edge border-t-line bg-panel"
              >
                {MAIS.map((item) => (
                  <Link
                    key={item.href}
                    role="menuitem"
                    href={item.href}
                    title={item.title}
                    onClick={() => setMaisOpen(false)}
                    className={`block border-b border-hair px-4 py-3 font-mono text-[10px] tracking-[.16em] last:border-b-0 hover:bg-hoverrow hover:text-ink ${
                      active === item.href ? "text-ink" : "text-sec"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <span className="flex-1" />
        </nav>

        {/* bloco direito: relógio + github */}
        <div className="ml-auto flex items-center gap-[18px] border-l border-line px-5 lg:ml-0">
          <HeaderClock />
          <a
            href={REPO}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Código-fonte no GitHub (AGPL-3.0)"
            title="Código-fonte (AGPL-3.0)"
            className="hidden h-[30px] w-[30px] items-center justify-center border border-edge font-mono text-[10px] text-sec hover:border-edgehover hover:text-ink sm:flex"
          >
            &lt;/&gt;
          </a>
          {/* toggle mobile */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-[30px] w-[30px] items-center justify-center border border-edge font-mono text-[12px] text-sec hover:border-edgehover hover:text-ink lg:hidden"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
          >
            {open ? "✕" : "≡"}
          </button>
        </div>
      </header>

      {/* painel mobile */}
      {open ? (
        <nav id="mobile-nav" className="border-b border-line bg-panel lg:hidden" aria-label="Navegação principal (móvel)">
          {[...NAV, ...MAIS].map((item) => {
            const isActive = active === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-2 border-b border-hair px-5 py-3.5 font-mono text-[11px] tracking-[.16em] last:border-b-0 ${
                  isActive ? "bg-cellhead text-ink" : "text-sec"
                }`}
              >
                {item.live ? <span className="pulse-live h-1.5 w-1.5 rounded-full bg-registro" /> : null}
                {item.label}
              </Link>
            );
          })}
        </nav>
      ) : null}

      <FidelityRibbon />
    </div>
  );
}
