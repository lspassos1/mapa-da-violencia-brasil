"use client";

import { useEffect, useState } from "react";

// Relógio do header ISOLADO em componente próprio: o tick de 1s re-renderiza
// SÓ este bloco, nunca a árvore do header/página — as animações CSS (pulso,
// halo, varredura) seguem contínuas. Começa com placeholder no SSR e só mostra
// a hora após montar (evita mismatch de hidratação).
const DIAS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const p2 = (n: number) => String(n).padStart(2, "0");

function fmtRelogio(d: Date): string {
  return `${DIAS[d.getDay()]} ${p2(d.getDate())} ${MESES[d.getMonth()]} ${d.getFullYear()} · ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())} BRT`;
}

// Janela viva do radar (últimos 7 dias): "24–30 JUN 2026".
function fmtJanela(d: Date): string {
  const ini = new Date(d.getTime() - 6 * 86400000);
  const fim = `${p2(d.getDate())} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
  if (ini.getMonth() === d.getMonth()) return `${p2(ini.getDate())}–${fim}`;
  return `${p2(ini.getDate())} ${MESES[ini.getMonth()]} – ${fim}`;
}

export function HeaderClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div aria-hidden="true" className="hidden text-right leading-[1.4] md:block" suppressHydrationWarning>
      <div className="font-mono text-[10px] tracking-[.12em] text-sec tabular-nums">
        {now ? fmtRelogio(now) : "— · --:--:-- BRT"}
      </div>
      <div className="font-mono text-[9px] tracking-[.14em] text-quat">
        JANELA {now ? fmtJanela(now) : "—"}
      </div>
    </div>
  );
}
