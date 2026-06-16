import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Info } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { getElectoralAnomalies, ELECTION_YEARS, INDICADOR } from "@/server/anomaly/electoralCycle";

export const metadata: Metadata = {
  title: "Radar de anomalia — ciclo eleitoral",
  description: "Quedas atípicas do homicídio reportado na janela pré-eleitoral, por UF (indício, não prova).",
  robots: { index: false, follow: false }, // feature preliminar / sensível
};

function fmt(n: number | null): string {
  return n === null ? "—" : n.toFixed(3);
}

// É indício a destacar: estado robusto com queda pré-eleitoral relevante.
function ehIndicio(efeito: number | null, robusto: boolean): boolean {
  return robusto && efeito !== null && efeito <= -0.05;
}

export default function RadarPage() {
  const ufs = getElectoralAnomalies();
  const indicios = ufs.filter((u) => ehIndicio(u.efeito, u.robusto)).length;

  return (
    <main className="flex min-h-screen flex-col text-slate-100">
      <AppHeader />
      <div className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-4 p-4">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-cyan-300">Radar de anomalia</p>
          <h2 className="text-2xl font-semibold">Ciclo eleitoral × homicídio (dado oficial)</h2>
        </div>

        {/* Aviso inegociável: indício, não prova */}
        <div className="flex items-start gap-2 rounded-lg border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>Indício para investigar, não prova de manipulação.</strong> Um efeito negativo significa que o
            homicídio reportado cai na janela pré-eleitoral (ago–out) em anos de eleição mais do que em anos normais.
            Isso pode ter causas legítimas (operação policial, mudança de registro), ser subnotificação/reclassificação,
            ou coincidência. A literatura indica que esse ciclo costuma aparecer onde há crime organizado — por isso a
            próxima lente cruza com presença de facção/milícia.
          </p>
        </div>

        {/* Metodologia */}
        <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-slate-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
          <p>
            <strong>Como é medido:</strong> índice sazonal intra-UF (média ago–out ÷ média do ano), comparando anos de
            eleição ({ELECTION_YEARS.join(", ")}) com anos normais (2015–2025). Cada UF é comparada <em>consigo mesma</em>
            {" "}— evita a heterogeneidade de definição entre estados; <strong>não é ranking cru</strong>. Indicador:{" "}
            {INDICADOR}. Fonte: SINESP/VDE. {indicios} UF(s) robusta(s) com queda relevante (≤ −0,05).{" "}
            <Link className="underline hover:text-cyan-200" href="/metodologia">
              Metodologia
            </Link>
            .
          </p>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-white/[0.04] text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">UF</th>
                <th className="px-3 py-2" title="idxEleicao − idxNormal; negativo = queda pré-eleitoral">Efeito</th>
                <th className="px-3 py-2">Índice eleição</th>
                <th className="px-3 py-2">Índice normal</th>
                <th className="px-3 py-2">Média/mês</th>
                <th className="px-3 py-2">Sinal</th>
              </tr>
            </thead>
            <tbody>
              {ufs.map((u, i) => {
                const flag = ehIndicio(u.efeito, u.robusto);
                return (
                  <tr
                    key={u.uf}
                    className={`border-t border-white/5 ${flag ? "bg-amber-300/5" : ""} ${!u.robusto ? "text-slate-500" : ""}`}
                  >
                    <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                    <td className="px-3 py-2 font-semibold text-slate-100">{u.uf}</td>
                    <td className={`px-3 py-2 font-mono ${u.efeito !== null && u.efeito < 0 ? "text-amber-300" : "text-slate-300"}`}>
                      {fmt(u.efeito)}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-400">{fmt(u.idxEleicao)}</td>
                    <td className="px-3 py-2 font-mono text-slate-400">{fmt(u.idxNormal)}</td>
                    <td className="px-3 py-2 text-slate-400">{u.mediaMensal}</td>
                    <td className="px-3 py-2">
                      {!u.robusto ? (
                        <span className="text-[11px] text-slate-500">baixa amostra</span>
                      ) : flag ? (
                        <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                          indício · investigar
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-500">sem desvio relevante</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-slate-500">
          Próximas lentes do radar: (2) governança criminal — homicídio implausivelmente baixo para o perfil (facção/milícia),
          com corroboração OSINT; (3) homicídios ocultos (morte indeterminada ↑ enquanto homicídio ↓). Ver issue do projeto.
        </p>
      </div>
    </main>
  );
}
