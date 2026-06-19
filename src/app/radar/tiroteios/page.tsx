"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Crosshair, RefreshCw } from "lucide-react";
import { ShootingsMap, CONTEXTO_COR, CONTEXTO_LABEL } from "@/components/radar/ShootingsMap";
import type { Contexto, ShootingOccurrence } from "@/server/shootings/fogocruzado";

interface ApiResponse {
  ocorrencias: ShootingOccurrence[];
  meta: {
    fonte: string;
    cobertura?: string;
    dias?: number;
    disclaimer: string;
    total?: number;
    porContexto?: Record<Contexto, number>;
    porMunicipio?: MunicipioResumo[];
    mortos?: number;
    aviso?: string;
  };
}

interface MunicipioResumo {
  municipio: string;
  estado: string;
  total: number;
  disputa: number;
  mortos: number;
  disputaShare: number;
  lente2: "controle" | "disputa" | "misto" | null;
}

const LENTE2_BADGE: Record<"controle" | "disputa" | "misto", { label: string; cls: string }> = {
  controle: { label: "possível controle", cls: "bg-amber-300/15 text-amber-200" },
  disputa: { label: "disputa ativa", cls: "bg-red-400/15 text-red-200" },
  misto: { label: "misto", cls: "text-slate-500" },
};

export default function TiroteiosPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [contexto, setContexto] = useState<Contexto | "todos">("todos");

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch("/api/shootings");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as ApiResponse);
    } catch (e) {
      setErro(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/shootings")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => active && setData(json as ApiResponse))
      .catch((e) => active && setErro(String(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const todas = useMemo(() => data?.ocorrencias ?? [], [data]);
  const filtradas = useMemo(
    () =>
      [...todas]
        .filter((o) => contexto === "todos" || o.contexto === contexto)
        .sort((a, b) => (a.data < b.data ? 1 : -1)),
    [todas, contexto],
  );

  return (
    <main className="flex min-h-screen flex-col text-slate-100">
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 p-4">
        <div className="flex items-center gap-2 text-cyan-300">
          <Crosshair className="h-5 w-5" />
          <h2 className="text-lg font-semibold tracking-wide text-slate-100">Radar de tiroteios — tempo quase real</h2>
          <Link href="/radar" className="ml-auto text-xs text-slate-400 underline hover:text-cyan-200">
            ← radar de anomalia
          </Link>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>Não é alerta de emergência</strong> — em urgências, ligue 190. Registros de tiroteios/disparos da{" "}
            <a className="underline hover:text-amber-50" href="https://fogocruzado.org.br" target="_blank" rel="noopener noreferrer">
              Fogo Cruzado
            </a>{" "}
            (últimos {data?.meta.dias ?? 7} dias). <strong>Cobertura limitada</strong>:{" "}
            {data?.meta.cobertura ?? "regiões metropolitanas de Rio de Janeiro, Recife, Salvador e Belém"} — o Fogo Cruzado
            não cobre o Brasil todo. Atualiza periodicamente.
          </p>
        </div>

        {/* filtros + stats */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-slate-400">Contexto</span>
            <select
              className="rounded-md border border-white/10 bg-slate-950 px-2 py-1 text-slate-100"
              value={contexto}
              onChange={(e) => setContexto(e.target.value as Contexto | "todos")}
            >
              <option value="todos">Todos</option>
              <option value="disputa">{CONTEXTO_LABEL.disputa}</option>
              <option value="policia">{CONTEXTO_LABEL.policia}</option>
              <option value="outro">{CONTEXTO_LABEL.outro}</option>
            </select>
          </label>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            {(["disputa", "policia", "outro"] as Contexto[]).map((c) => (
              <span key={c} className="inline-flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: CONTEXTO_COR[c] }} />
                {CONTEXTO_LABEL[c]}: {data?.meta.porContexto?.[c] ?? 0}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={carregar}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-300/50 hover:text-cyan-200"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </button>
        </div>

        {data?.meta ? (
          <p className="text-xs text-slate-500">
            {filtradas.length} de {todas.length} ocorrências · {data.meta.mortos ?? 0} morto(s) na janela ·{" "}
            {todas.filter((o) => typeof o.lat === "number").length} no mapa
            {data.meta.aviso ? ` · ${data.meta.aviso}` : ""}
          </p>
        ) : null}

        <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_460px]">
          <div className="min-h-[360px] overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">A carregar…</div>
            ) : (
              <ShootingsMap ocorrencias={filtradas} />
            )}
          </div>

          <ul className="max-h-[660px] space-y-2 overflow-y-auto pr-1">
            {erro ? (
              <li className="rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">Falha ao carregar: {erro}</li>
            ) : null}
            {!loading && filtradas.length === 0 && !erro ? (
              <li className="rounded-lg border border-white/10 p-4 text-sm text-slate-400">Nenhuma ocorrência no filtro atual.</li>
            ) : null}
            {filtradas.slice(0, 200).map((o) => (
              <li key={o.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-100">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: CONTEXTO_COR[o.contexto] }} />
                    {CONTEXTO_LABEL[o.contexto]}
                  </span>
                  <span className="text-[11px] text-slate-500">{o.data.slice(0, 10)}</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  {o.bairro ? `${o.bairro} — ` : ""}
                  {o.municipio}/{o.estado}
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  {o.mortos} morto(s) · {o.feridos} ferido(s){o.mainReason ? ` · ${o.mainReason}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>

        {/* Análise por município (+ overlay da lente 2 no RJ) */}
        {data?.meta.porMunicipio?.length ? (
          <div className="mt-2">
            <h3 className="mb-2 text-sm font-semibold text-slate-200">
              Por município <span className="font-normal text-slate-500">— tiroteios na janela; no RJ, com a leitura estrutural (lente 2)</span>
            </h3>
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-white/[0.04] text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Município</th>
                    <th className="px-3 py-2">Tiroteios</th>
                    <th className="px-3 py-2" title="% dos tiroteios por disputa entre grupos">% disputa</th>
                    <th className="px-3 py-2">Mortos</th>
                    <th className="px-3 py-2">Estrutura (RJ)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.meta.porMunicipio.slice(0, 25).map((m) => (
                    <tr key={`${m.municipio}|${m.estado}`} className="border-t border-white/5">
                      <td className="px-3 py-2 font-medium text-slate-100">
                        {m.municipio}
                        <span className="text-slate-500"> / {m.estado}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-300">{m.total}</td>
                      <td className="px-3 py-2 font-mono text-slate-300">{(m.disputaShare * 100).toFixed(0)}%</td>
                      <td className="px-3 py-2 text-slate-400">{m.mortos}</td>
                      <td className="px-3 py-2">
                        {m.lente2 ? (
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${LENTE2_BADGE[m.lente2].cls}`}>
                            {LENTE2_BADGE[m.lente2].label}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              &quot;Estrutura&quot; cruza o tempo-real com a <Link className="underline hover:text-cyan-200" href="/radar">lente 2</Link>{" "}
              (controle×disputa) — só municípios do RJ têm essa leitura. Indício, não acusação.
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
