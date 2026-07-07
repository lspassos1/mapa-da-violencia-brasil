"use client";

import { useState } from "react";

// "A tesoura estatística" — visualização interativa da lente 3 (referência do
// design handoff): homicídios (área+linha vermelha, eixo esquerdo) se cruzando
// com a parcela de mortes por causa indeterminada (tracejado âmbar com losangos,
// eixo direito). Honestidade > rótulo da referência: o valor plotado é
// razaoMvci = MVCI ÷ (homicídios + MVCI) — o mesmo número da lente 3 — e o
// rótulo declara a fórmula (a referência o chamava de "MVCI/homicídio").
export interface TesouraSerie {
  uf: string;
  nome: string;
  pontos: { ano: number; h: number; r: number; mvci: number }[];
}

const CHIPS = ["SP", "MG", "RJ", "CE", "SC", "MS"];
const fmtInt = (n: number) => n.toLocaleString("pt-BR");
const fmtR = (r: number) => r.toFixed(2).replace(".", ",");

function frase(nome: string, pontos: TesouraSerie["pontos"]): string {
  const a = pontos[0];
  const b = pontos[pontos.length - 1];
  const dirH = b.h <= a.h ? "caíram" : "subiram";
  const dirR = b.r >= a.r ? "subiu" : "caiu";
  const ratio = b.h > 0 ? b.mvci / b.h : 0;
  const propor =
    ratio >= 0.9
      ? `para cada homicídio registrado, ~${Math.max(1, Math.round(ratio))} morte(s) entraram como “causa indeterminada”`
      : ratio >= 0.45
        ? "para cada 2 homicídios registrados, ~1 morte entrou como “causa indeterminada”"
        : ratio >= 0.22
          ? "para cada 4 homicídios registrados, ~1 morte entrou como “causa indeterminada”"
          : "as mortes por causa indeterminada seguem baixas em relação aos homicídios";
  return `Em ${nome}, os homicídios registrados ${dirH} de ${fmtInt(a.h)} (${a.ano}) para ${fmtInt(b.h)} (${b.ano}), enquanto a parcela indeterminada ${dirR} de ${fmtR(a.r)} para ${fmtR(b.r)} — ${propor}.`;
}

// Gráfico dual-axis (geometria da referência: 640×320, eixos independentes).
function Grafico({ pontos }: { pontos: TesouraSerie["pontos"] }) {
  if (pontos.length < 2) return null; // série curta: sem geometria válida (evita NaN)
  const W = 640;
  const H = 320;
  const padL = 46;
  const padR = 52;
  const padT = 22;
  const padB = 30;
  const hMax = Math.max(...pontos.map((p) => p.h)) * 1.08;
  const rMax = Math.max(0.7, Math.max(...pontos.map((p) => p.r)) * 1.15);
  const x = (i: number) => padL + (i / (pontos.length - 1)) * (W - padL - padR);
  const yH = (v: number) => padT + (1 - v / hMax) * (H - padT - padB);
  const yR = (v: number) => padT + (1 - v / rMax) * (H - padT - padB);

  let hd = "";
  pontos.forEach((p, i) => {
    hd += (i === 0 ? "M" : "L") + x(i).toFixed(1) + " " + yH(p.h).toFixed(1);
  });
  const ha = hd + `L${x(pontos.length - 1).toFixed(1)} ${yH(0)}L${x(0).toFixed(1)} ${yH(0)}Z`;
  let rd = "";
  pontos.forEach((p, i) => {
    rd += (i === 0 ? "M" : "L") + x(i).toFixed(1) + " " + yR(p.r).toFixed(1);
  });
  const lastX = x(pontos.length - 1);
  const lastY = yR(pontos[pontos.length - 1].r);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="block" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => {
        const v = (hMax * i) / 3;
        const yy = yH(v);
        return (
          <g key={i}>
            <line x1={padL} y1={yy} x2={W - padR} y2={yy} stroke="#1A1D22" strokeWidth="1" />
            <text x={padL - 8} y={yy + 3} textAnchor="end" fill="#565B63" fontSize="9.5" fontFamily="var(--font-plex-mono), monospace">
              {fmtInt(Math.round(v))}
            </text>
            <text x={W - padR + 10} y={yR((rMax * i) / 3) + 3} fill="#8A6B33" fontSize="9.5" fontFamily="var(--font-plex-mono), monospace">
              {fmtR((rMax * i) / 3)}
            </text>
          </g>
        );
      })}
      <path d={ha} fill="rgba(229,72,77,.07)" />
      <path d={hd} fill="none" stroke="#E5484D" strokeWidth="1.8" />
      <path d={rd} fill="none" stroke="#E2A33B" strokeWidth="1.6" strokeDasharray="5 4" />
      {pontos.map((p, i) => (
        <g key={p.ano}>
          <rect
            x={x(i) - 3}
            y={yR(p.r) - 3}
            width="6"
            height="6"
            transform={`rotate(45 ${x(i)} ${yR(p.r)})`}
            fill="#0A0B0D"
            stroke="#E2A33B"
            strokeWidth="1.2"
          />
          <text x={x(i)} y={H - 8} textAnchor="middle" fill={i % 2 ? "#3F444C" : "#6C717A"} fontSize="9.5" fontFamily="var(--font-plex-mono), monospace">
            {"’" + String(p.ano).slice(2)}
          </text>
        </g>
      ))}
      <circle cx={lastX} cy={lastY} r="8" fill="none" stroke="rgba(226,163,59,.5)" strokeWidth="1" />
    </svg>
  );
}

export function TesouraEstatistica({ series }: { series: TesouraSerie[] }) {
  const [ufSel, setUfSel] = useState("SP");
  // só séries com >=2 anos entram (chips, ranking e gráfico) — UF vazia/parcial
  // num asset regenerado não pode crashar a seção
  const validas = series.filter((s) => s.pontos.length >= 2);
  const atual = validas.find((s) => s.uf === ufSel) ?? validas[0];
  if (!atual) return null;
  const ultimo = atual.pontos[atual.pontos.length - 1];
  const rank = [...validas]
    .map((s) => ({ uf: s.uf, r: s.pontos[s.pontos.length - 1]?.r ?? 0 }))
    .sort((a, b) => b.r - a.r)
    .slice(0, 8);
  const rankMax = rank[0]?.r || 1;

  return (
    <section className="grid grid-cols-1 border border-line lg:grid-cols-[minmax(0,1fr)_380px]" aria-label="A tesoura estatística — visualização da lente 3">
      <div className="border-r border-hair px-7 py-[26px]">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <p className="font-mono text-[9.5px] tracking-[.24em] text-quat">LENTE 03 — VISUALIZAÇÃO</p>
            <h3 className="mt-2 text-[26px] font-[620] text-ink [font-stretch:112%]">A tesoura estatística</h3>
          </div>
          <div className="flex flex-wrap gap-[5px]" role="group" aria-label="Trocar UF do gráfico">
            {CHIPS.filter((uf) => validas.some((s) => s.uf === uf)).map((uf) => {
              const act = ufSel === uf;
              return (
                <button
                  key={uf}
                  type="button"
                  onClick={() => setUfSel(uf)}
                  aria-pressed={act}
                  className="px-3 py-1.5 font-mono text-[10px] tracking-[.12em] hover:border-edgehover hover:text-ink"
                  style={{
                    background: act ? "rgba(226,163,59,.12)" : "transparent",
                    border: `1px solid ${act ? "rgba(226,163,59,.55)" : "#262B33"}`,
                    color: act ? "#E2A33B" : "#797F88",
                  }}
                >
                  {uf}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-[18px] overflow-x-auto">
          <div className="h-[320px] min-w-[560px]">
            <Grafico pontos={atual.pontos} />
          </div>
        </div>
        <div className="mt-3.5 flex flex-wrap gap-5 font-mono text-[9.5px] tracking-[.1em] text-ter">
          <span className="flex items-center gap-[7px]">
            <span className="h-0.5 w-4 bg-registro" />
            HOMICÍDIOS (SIM/DATASUS)
          </span>
          <span className="flex items-center gap-[7px]">
            <span className="w-4 border-t-2 border-dashed border-indicio" />
            PARCELA INDETERMINADA — MVCI ÷ (HOM + MVCI)
          </span>
        </div>
      </div>

      <aside className="flex flex-col gap-[18px] bg-panel px-6 py-[26px]">
        <div aria-live="polite">
          <p className="font-mono text-[9.5px] tracking-[.22em] text-quat">LEITURA — {atual.nome.toUpperCase()}</p>
          <div className="mt-2.5 flex items-baseline gap-2.5">
            <span className="text-[52px] font-[640] leading-none text-indicio [font-stretch:112%]">{fmtR(ultimo.r)}</span>
            <span className="font-mono text-[10px] leading-[1.6] text-ter">
              parcela indeterminada
              <br />
              MVCI ÷ (hom+MVCI) · {ultimo.ano}
            </span>
          </div>
          <p className="mt-3 text-[13px] leading-[1.65] text-sec">{frase(atual.nome, atual.pontos)}</p>
        </div>
        <div className="border-t border-line pt-4">
          <p className="mb-2.5 font-mono text-[9.5px] tracking-[.22em] text-quat">PARCELA MVCI {ultimo.ano} — MAIORES</p>
          <div className="flex flex-col gap-[7px]">
            {rank.map((r) => {
              const act = ufSel === r.uf;
              return (
                <button
                  key={r.uf}
                  type="button"
                  onClick={() => setUfSel(r.uf)}
                  aria-pressed={act}
                  className="flex w-full items-center gap-2.5 px-1.5 py-[5px] text-left hover:bg-hoverrow"
                  style={{ background: act ? "#14171D" : undefined }}
                >
                  <span className="w-[30px] flex-none text-[11.5px] font-[520] text-[#C9C7C1]">{r.uf}</span>
                  <span className="relative h-[5px] flex-1 bg-hair">
                    <span
                      className="absolute inset-y-0 left-0"
                      style={{ width: `${((r.r / rankMax) * 100).toFixed(1)}%`, background: "linear-gradient(90deg, rgba(226,163,59,.25), #E2A33B)" }}
                    />
                  </span>
                  <span className="w-9 flex-none text-right font-mono text-[10.5px] text-indicio">{fmtR(r.r)}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 font-mono text-[9px] leading-[1.8] tracking-[.06em] text-quat">
            PARCELA ALTA ≠ FRAUDE. É SINAL DE QUALIDADE DE CLASSIFICAÇÃO — INDÍCIO PARA AUDITAR O REGISTRO, NUNCA VEREDITO.
          </p>
        </div>
      </aside>
    </section>
  );
}
